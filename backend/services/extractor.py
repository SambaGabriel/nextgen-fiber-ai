"""
NextGen Fiber AI Agent - PDF Extractor
Vision AI-based extraction with absolute accuracy requirement
"""

import anthropic
import google.generativeai as genai
import base64
import json
from typing import Optional
from datetime import datetime, timezone

from core import get_settings, get_logger, audit_logger

logger = get_logger(__name__)
settings = get_settings()


# Strict extraction prompt - no approximations allowed
EXTRACTION_PROMPT = """You are a precision data extraction system for fiber optic construction reports.

DOCUMENT TYPE: "Produção Diária" (Daily Production Report)

CRITICAL RULES:
1. Extract EXACTLY what is written - NO approximations, NO assumptions
2. If a value is unclear, mark it as "UNCLEAR" - never guess
3. Preserve original formatting of IDs (e.g., "BSPD01.05", "30054.30112")
4. Checkboxes: only mark true if CLEARLY checked/filled

HEADER FIELDS TO EXTRACT:
- lineman_name: "Lineman (Nome):" field
- start_date: "Data de Inicio:" field (format: MM.DD.YYYY)
- end_date: "Data de Termino:" field (format: MM.DD.YYYY)
- city: "Cidade:" field
- project_name: "Nome do Projeto:" field
- fiber_count: "Fibra:" field (number)
- run_id: "Corrida identificação:" field
- declared_total_feet: "Total pés de span:" field (number)
- service_type: "Serviço:" field

TABLE ROWS TO EXTRACT (for each row with data):
- span_feet: "Stran Span" column (number)
- anchor: "Anchora" column checkbox (true/false)
- pole_id_raw: "Pes de Fibra" column (exact text including notes)
- coil: "Coil" column checkbox (true/false)
- snowshoe: "Snowshoe" column checkbox (true/false)

IMPORTANT:
- "Pes de Fibra" may contain:
  - Single ID: "30208"
  - Double ID (splice point): "24154.24235"
  - ID with note: "34062.deixamos uma figura 8"
- Extract ALL rows until you reach the "Total" row
- Count number of rows extracted for verification

OUTPUT FORMAT: Valid JSON matching the schema provided.
"""

EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "header": {
            "type": "object",
            "properties": {
                "lineman_name": {"type": "string"},
                "start_date": {"type": "string", "description": "Format: YYYY-MM-DD"},
                "end_date": {"type": "string", "description": "Format: YYYY-MM-DD"},
                "city": {"type": "string"},
                "project_name": {"type": "string"},
                "fiber_count": {"type": "integer"},
                "run_id": {"type": "string"},
                "declared_total_feet": {"type": "integer"},
                "service_type": {"type": "string"}
            },
            "required": ["lineman_name", "start_date", "end_date", "project_name", "fiber_count", "run_id", "declared_total_feet", "service_type"]
        },
        "entries": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "span_feet": {"type": "integer"},
                    "anchor": {"type": "boolean"},
                    "pole_id_raw": {"type": "string"},
                    "coil": {"type": "boolean"},
                    "snowshoe": {"type": "boolean"}
                },
                "required": ["span_feet", "pole_id_raw"]
            }
        },
        "extraction_notes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Any notes about unclear or problematic extractions"
        },
        "row_count": {"type": "integer", "description": "Total data rows extracted"}
    },
    "required": ["header", "entries", "row_count"]
}


class PDFExtractor:
    """
    Extract structured data from Production Report PDFs

    Uses Vision AI (Claude or Gemini) with strict accuracy requirements
    """

    def __init__(self, provider: str = "anthropic"):
        """
        Initialize extractor

        Args:
            provider: "anthropic" for Claude, "google" for Gemini
        """
        self.provider = provider

        if provider == "anthropic":
            if not settings.anthropic_api_key:
                raise ValueError("ANTHROPIC_API_KEY not configured")
            self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        elif provider == "google":
            if not settings.google_api_key:
                raise ValueError("GOOGLE_API_KEY not configured")
            genai.configure(api_key=settings.google_api_key)
            self.model = genai.GenerativeModel('gemini-1.5-pro')
        else:
            raise ValueError(f"Unknown provider: {provider}")

        logger.info("pdf_extractor_initialized", provider=provider)

    async def extract_from_base64(
        self,
        base64_data: str,
        filename: str,
        mime_type: str = "application/pdf"
    ) -> dict:
        """
        Extract production report data from base64-encoded PDF

        Args:
            base64_data: Base64-encoded PDF content
            filename: Original filename for logging
            mime_type: MIME type of the document

        Returns:
            Extracted data as dictionary

        Raises:
            ExtractionError: If extraction fails or data is unreliable
        """
        document_id = f"DOC-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

        logger.info(
            "extraction_started",
            document_id=document_id,
            filename=filename,
            provider=self.provider
        )

        try:
            if self.provider == "anthropic":
                result = await self._extract_with_claude(base64_data, mime_type)
            else:
                result = await self._extract_with_gemini(base64_data, mime_type)

            # Log extraction for audit
            audit_logger.log_extraction(
                document_id=document_id,
                document_name=filename,
                extraction_result=result,
                user_id=None  # Will be added when auth is implemented
            )

            result["_extraction_metadata"] = {
                "document_id": document_id,
                "filename": filename,
                "provider": self.provider,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            return result

        except Exception as e:
            logger.error(
                "extraction_failed",
                document_id=document_id,
                error=str(e),
                provider=self.provider
            )
            raise

    async def _extract_with_claude(self, base64_data: str, mime_type: str) -> dict:
        """Extract using Claude Vision"""

        # Clean base64 if it has data URI prefix
        if "base64," in base64_data:
            base64_data = base64_data.split("base64,")[1]

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": base64_data
                            }
                        },
                        {
                            "type": "text",
                            "text": f"{EXTRACTION_PROMPT}\n\nReturn ONLY valid JSON matching this schema:\n{json.dumps(EXTRACTION_SCHEMA, indent=2)}"
                        }
                    ]
                }
            ]
        )

        # Parse response
        response_text = message.content[0].text

        # Extract JSON from response
        try:
            # Try to find JSON in response
            if "```json" in response_text:
                json_str = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                json_str = response_text.split("```")[1].split("```")[0]
            else:
                json_str = response_text

            return json.loads(json_str.strip())
        except json.JSONDecodeError as e:
            logger.error("json_parse_error", response=response_text[:500], error=str(e))
            raise ValueError(f"Failed to parse extraction result: {e}")

    async def _extract_with_gemini(self, base64_data: str, mime_type: str) -> dict:
        """Extract using Gemini Vision"""

        # Clean base64 if it has data URI prefix
        if "base64," in base64_data:
            base64_data = base64_data.split("base64,")[1]

        # Prepare content for Gemini
        pdf_part = {
            "mime_type": mime_type,
            "data": base64_data
        }

        prompt = f"{EXTRACTION_PROMPT}\n\nReturn ONLY valid JSON matching this schema:\n{json.dumps(EXTRACTION_SCHEMA, indent=2)}"

        response = self.model.generate_content(
            [pdf_part, prompt],
            generation_config={
                "temperature": 0,
                "response_mime_type": "application/json"
            }
        )

        try:
            return json.loads(response.text)
        except json.JSONDecodeError as e:
            logger.error("json_parse_error", response=response.text[:500], error=str(e))
            raise ValueError(f"Failed to parse extraction result: {e}")
