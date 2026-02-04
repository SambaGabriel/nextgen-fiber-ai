"""
Email API - Send supervisor reports via email
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import base64
import os
from datetime import datetime

router = APIRouter()

# Target email for all supervisor reports
TARGET_EMAIL = "ngf@nextgenfiberllc.com"

class SupervisorReportRequest(BaseModel):
    """Request model for supervisor report email"""
    lineman_name: str
    report_date: str
    transcript: str
    summary: Optional[str] = None
    violations: Optional[list] = None
    pdf_base64: Optional[str] = None  # Base64 encoded PDF


@router.post("/send-supervisor-report")
async def send_supervisor_report(request: SupervisorReportRequest):
    """
    Send supervisor conversation report to ngf@nextgenfiberllc.com
    Bilingual support - report is generated in the conversation language
    """
    try:
        # Get SMTP settings from environment
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASS", "")

        if not smtp_user or not smtp_pass:
            # If SMTP not configured, log the report and return success
            # In production, you'd want to configure proper SMTP
            print(f"[EMAIL SERVICE] Report for {request.lineman_name} on {request.report_date}")
            print(f"[EMAIL SERVICE] Transcript length: {len(request.transcript)} chars")
            print(f"[EMAIL SERVICE] Would send to: {TARGET_EMAIL}")

            return {
                "success": True,
                "message": "Report logged (SMTP not configured)",
                "recipient": TARGET_EMAIL,
                "lineman": request.lineman_name,
                "date": request.report_date
            }

        # Create email message
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = TARGET_EMAIL
        msg['Subject'] = f"🚨 Supervisor Report - {request.lineman_name} - {request.report_date}"

        # Build email body (bilingual-friendly HTML)
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f7; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 30px; }}
                .header h1 {{ margin: 0; font-size: 24px; font-weight: 800; }}
                .header p {{ margin: 8px 0 0; opacity: 0.9; font-size: 14px; }}
                .content {{ padding: 30px; }}
                .meta {{ display: flex; gap: 20px; margin-bottom: 20px; }}
                .meta-item {{ flex: 1; background: #f5f5f7; padding: 15px; border-radius: 12px; }}
                .meta-label {{ font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6e6e73; font-weight: 700; }}
                .meta-value {{ font-size: 16px; font-weight: 700; color: #1d1d1f; margin-top: 4px; }}
                .section {{ margin-top: 25px; }}
                .section-title {{ font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6e6e73; font-weight: 700; margin-bottom: 12px; }}
                .transcript {{ background: #f5f5f7; padding: 20px; border-radius: 12px; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }}
                .violations {{ background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 12px; color: #dc2626; }}
                .footer {{ padding: 20px 30px; background: #f5f5f7; text-align: center; font-size: 11px; color: #6e6e73; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📋 Supervisor Conversation Report</h1>
                    <p>NextGen Fiber AI - Field Operations</p>
                </div>
                <div class="content">
                    <div class="meta">
                        <div class="meta-item">
                            <div class="meta-label">Lineman / Técnico</div>
                            <div class="meta-value">{request.lineman_name}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Date / Fecha / Data</div>
                            <div class="meta-value">{request.report_date}</div>
                        </div>
                    </div>

                    {f'''
                    <div class="section">
                        <div class="section-title">⚠️ Violations Detected / Violaciones Detectadas / Violações Detectadas</div>
                        <div class="violations">
                            {"<br>".join(request.violations) if request.violations else "No violations detected"}
                        </div>
                    </div>
                    ''' if request.violations else ''}

                    {f'''
                    <div class="section">
                        <div class="section-title">📝 Summary / Resumen / Resumo</div>
                        <p style="font-size: 14px; line-height: 1.6;">{request.summary}</p>
                    </div>
                    ''' if request.summary else ''}

                    <div class="section">
                        <div class="section-title">💬 Full Transcript / Transcripción Completa / Transcrição Completa</div>
                        <div class="transcript">{request.transcript}</div>
                    </div>
                </div>
                <div class="footer">
                    Generated by NextGen Fiber AI Supervisor System<br>
                    {datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")}
                </div>
            </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(html_body, 'html'))

        # Attach PDF if provided
        if request.pdf_base64:
            pdf_data = base64.b64decode(request.pdf_base64)
            pdf_attachment = MIMEBase('application', 'pdf')
            pdf_attachment.set_payload(pdf_data)
            encoders.encode_base64(pdf_attachment)
            pdf_attachment.add_header(
                'Content-Disposition',
                f'attachment; filename="Supervisor_Report_{request.lineman_name}_{request.report_date}.pdf"'
            )
            msg.attach(pdf_attachment)

        # Send email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        return {
            "success": True,
            "message": "Report sent successfully",
            "recipient": TARGET_EMAIL,
            "lineman": request.lineman_name,
            "date": request.report_date
        }

    except Exception as e:
        print(f"[EMAIL ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
