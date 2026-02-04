"""
NextGen Fiber AI Agent - SmartSheets Integration
Bidirectional sync with SmartSheets for production data
"""

import smartsheet
from smartsheet.models import Cell, Row, Column
from typing import Optional
from datetime import datetime, timezone
from enum import Enum

from core import get_settings, get_logger, audit_logger
from models import ProductionReport, ProductionReportHeader, PoleEntry

logger = get_logger(__name__)
settings = get_settings()


class ColumnType(str, Enum):
    """SmartSheets column types"""
    TEXT_NUMBER = "TEXT_NUMBER"
    DATE = "DATE"
    CHECKBOX = "CHECKBOX"
    PICKLIST = "PICKLIST"
    CONTACT_LIST = "CONTACT_LIST"


class SmartSheetsClient:
    """
    Low-level SmartSheets API client

    Handles authentication and basic CRUD operations
    """

    def __init__(self, api_key: str = None):
        """
        Initialize SmartSheets client

        Args:
            api_key: SmartSheets API access token. If not provided, uses config.
        """
        self.api_key = api_key or settings.smartsheet_api_key

        if not self.api_key:
            raise ValueError("SmartSheets API key not configured. Set SMARTSHEET_API_KEY.")

        self.client = smartsheet.Smartsheet(self.api_key)
        self.client.errors_as_exceptions(True)

        logger.info("smartsheets_client_initialized")

    def test_connection(self) -> dict:
        """Test API connection and return user info"""
        try:
            user = self.client.Users.get_current_user()
            return {
                "connected": True,
                "user_id": user.id,
                "email": user.email,
                "name": f"{user.first_name} {user.last_name}"
            }
        except Exception as e:
            logger.error("smartsheets_connection_failed", error=str(e))
            return {
                "connected": False,
                "error": str(e)
            }

    def list_sheets(self, include_workspace: bool = True) -> list[dict]:
        """
        List all accessible sheets

        Returns:
            List of sheet metadata
        """
        try:
            response = self.client.Sheets.list_sheets(include_all=True)
            sheets = []

            for sheet in response.data:
                sheets.append({
                    "id": sheet.id,
                    "name": sheet.name,
                    "permalink": sheet.permalink,
                    "created_at": sheet.created_at.isoformat() if sheet.created_at else None,
                    "modified_at": sheet.modified_at.isoformat() if sheet.modified_at else None,
                    "total_row_count": getattr(sheet, 'total_row_count', 0)
                })

            logger.info("sheets_listed", count=len(sheets))
            return sheets

        except Exception as e:
            logger.error("list_sheets_failed", error=str(e))
            raise

    def get_sheet(self, sheet_id: int) -> dict:
        """
        Get sheet with all columns and rows

        Args:
            sheet_id: SmartSheets sheet ID

        Returns:
            Sheet data with columns and rows
        """
        try:
            sheet = self.client.Sheets.get_sheet(sheet_id)

            columns = [
                {
                    "id": col.id,
                    "title": col.title,
                    "type": col.type,
                    "index": col.index,
                    "primary": getattr(col, 'primary', False)
                }
                for col in sheet.columns
            ]

            rows = []
            for row in sheet.rows:
                row_data = {
                    "id": row.id,
                    "row_number": row.row_number,
                    "cells": {}
                }
                for cell in row.cells:
                    col = next((c for c in sheet.columns if c.id == cell.column_id), None)
                    if col:
                        row_data["cells"][col.title] = {
                            "value": cell.value,
                            "display_value": cell.display_value,
                            "column_id": cell.column_id
                        }
                rows.append(row_data)

            return {
                "id": sheet.id,
                "name": sheet.name,
                "columns": columns,
                "rows": rows,
                "total_row_count": sheet.total_row_count
            }

        except Exception as e:
            logger.error("get_sheet_failed", sheet_id=sheet_id, error=str(e))
            raise

    def get_columns(self, sheet_id: int) -> list[dict]:
        """Get column definitions for a sheet"""
        try:
            sheet = self.client.Sheets.get_sheet(sheet_id)
            return [
                {
                    "id": col.id,
                    "title": col.title,
                    "type": col.type,
                    "index": col.index,
                    "primary": getattr(col, 'primary', False),
                    "options": getattr(col, 'options', None)
                }
                for col in sheet.columns
            ]
        except Exception as e:
            logger.error("get_columns_failed", sheet_id=sheet_id, error=str(e))
            raise

    def add_row(self, sheet_id: int, cell_data: dict[str, any]) -> dict:
        """
        Add a single row to sheet

        Args:
            sheet_id: Target sheet ID
            cell_data: Dict mapping column titles to values

        Returns:
            Created row info
        """
        try:
            # Get column mapping
            columns = self.get_columns(sheet_id)
            col_map = {c["title"]: c["id"] for c in columns}

            # Build cells
            cells = []
            for col_title, value in cell_data.items():
                if col_title in col_map:
                    cell = Cell()
                    cell.column_id = col_map[col_title]
                    cell.value = value
                    cells.append(cell)

            # Create row
            new_row = Row()
            new_row.to_bottom = True
            new_row.cells = cells

            response = self.client.Sheets.add_rows(sheet_id, [new_row])

            if response.result:
                created_row = response.result[0]
                logger.info(
                    "row_added",
                    sheet_id=sheet_id,
                    row_id=created_row.id
                )
                return {
                    "success": True,
                    "row_id": created_row.id,
                    "row_number": created_row.row_number
                }

            return {"success": False, "error": "No result returned"}

        except Exception as e:
            logger.error("add_row_failed", sheet_id=sheet_id, error=str(e))
            raise

    def add_rows(self, sheet_id: int, rows_data: list[dict[str, any]]) -> dict:
        """
        Add multiple rows to sheet (batch operation)

        Args:
            sheet_id: Target sheet ID
            rows_data: List of dicts mapping column titles to values

        Returns:
            Batch result info
        """
        try:
            # Get column mapping
            columns = self.get_columns(sheet_id)
            col_map = {c["title"]: c["id"] for c in columns}

            # Build all rows
            new_rows = []
            for row_data in rows_data:
                cells = []
                for col_title, value in row_data.items():
                    if col_title in col_map:
                        cell = Cell()
                        cell.column_id = col_map[col_title]
                        cell.value = value
                        cells.append(cell)

                new_row = Row()
                new_row.to_bottom = True
                new_row.cells = cells
                new_rows.append(new_row)

            # Batch add (SmartSheets allows up to 500 rows per request)
            response = self.client.Sheets.add_rows(sheet_id, new_rows)

            added_count = len(response.result) if response.result else 0

            logger.info(
                "rows_added_batch",
                sheet_id=sheet_id,
                requested=len(rows_data),
                added=added_count
            )

            return {
                "success": True,
                "added_count": added_count,
                "row_ids": [r.id for r in response.result] if response.result else []
            }

        except Exception as e:
            logger.error("add_rows_batch_failed", sheet_id=sheet_id, error=str(e))
            raise

    def find_row_by_value(self, sheet_id: int, column_title: str, value: any) -> Optional[dict]:
        """
        Find a row by matching a column value

        Args:
            sheet_id: Sheet to search
            column_title: Column to match
            value: Value to find

        Returns:
            Row data if found, None otherwise
        """
        try:
            sheet_data = self.get_sheet(sheet_id)

            for row in sheet_data["rows"]:
                cell = row["cells"].get(column_title)
                if cell and cell["value"] == value:
                    return row

            return None

        except Exception as e:
            logger.error("find_row_failed", sheet_id=sheet_id, error=str(e))
            raise

    def update_row(self, sheet_id: int, row_id: int, cell_data: dict[str, any]) -> dict:
        """
        Update an existing row

        Args:
            sheet_id: Sheet ID
            row_id: Row ID to update
            cell_data: Dict mapping column titles to new values

        Returns:
            Update result
        """
        try:
            # Get column mapping
            columns = self.get_columns(sheet_id)
            col_map = {c["title"]: c["id"] for c in columns}

            # Build cells
            cells = []
            for col_title, value in cell_data.items():
                if col_title in col_map:
                    cell = Cell()
                    cell.column_id = col_map[col_title]
                    cell.value = value
                    cells.append(cell)

            # Update row
            update_row = Row()
            update_row.id = row_id
            update_row.cells = cells

            response = self.client.Sheets.update_rows(sheet_id, [update_row])

            if response.result:
                logger.info(
                    "row_updated",
                    sheet_id=sheet_id,
                    row_id=row_id
                )
                return {"success": True, "row_id": row_id}

            return {"success": False, "error": "No result returned"}

        except Exception as e:
            logger.error("update_row_failed", sheet_id=sheet_id, row_id=row_id, error=str(e))
            raise


class ColumnMapping:
    """
    Maps ProductionReport fields to SmartSheet columns

    Default mapping based on typical NextGen sheet structure
    """

    # Default column mappings (can be customized per sheet)
    DEFAULT_HEADER_MAPPING = {
        "lineman_name": "Sheet Name",  # Lineman names
        "project_name": "Project",
        "run_id": "Run ID",
        "start_date": "Date",
        "fiber_count": "Fiber",
        "service_type": "Service",
        "city": "Location",
        "declared_total_feet": "Total Feet",
        "customer": "Customer"
    }

    DEFAULT_PRODUCTION_MAPPING = {
        "run_id": "Feeder",
        "calculated_total_feet": "Production",
        "total_anchors": "Anchors",
        "total_coils": "Coils",
        "qc_status": "QC Status",
        "sync_date": "Last Updated"
    }

    def __init__(self, custom_mapping: dict = None):
        """
        Initialize with optional custom mapping

        Args:
            custom_mapping: Override default mappings
        """
        self.header_mapping = {**self.DEFAULT_HEADER_MAPPING}
        self.production_mapping = {**self.DEFAULT_PRODUCTION_MAPPING}

        if custom_mapping:
            if "header" in custom_mapping:
                self.header_mapping.update(custom_mapping["header"])
            if "production" in custom_mapping:
                self.production_mapping.update(custom_mapping["production"])

    def map_report_to_row(self, report: ProductionReport, include_entries: bool = False) -> dict:
        """
        Convert ProductionReport to SmartSheet row data

        Args:
            report: ProductionReport to convert
            include_entries: If True, includes individual pole entries

        Returns:
            Dict ready for SmartSheets add_row
        """
        row_data = {}

        # Map header fields
        for field, column in self.header_mapping.items():
            value = getattr(report.header, field, None)
            if value is not None:
                # Convert date to string
                if hasattr(value, 'isoformat'):
                    value = value.isoformat()
                row_data[column] = value

        # Map calculated fields
        for field, column in self.production_mapping.items():
            if field == "sync_date":
                row_data[column] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
            elif hasattr(report, field):
                row_data[column] = getattr(report, field)

        return row_data


class SmartSheetsSync:
    """
    High-level sync operations for production reports

    Handles bidirectional sync with conflict resolution
    """

    def __init__(self, client: SmartSheetsClient = None, mapping: ColumnMapping = None):
        """
        Initialize sync service

        Args:
            client: SmartSheetsClient instance
            mapping: Column mapping configuration
        """
        self.client = client or SmartSheetsClient()
        self.mapping = mapping or ColumnMapping()

    def sync_production_report(
        self,
        report: ProductionReport,
        sheet_id: int,
        update_existing: bool = True
    ) -> dict:
        """
        Sync a production report to SmartSheets

        Args:
            report: ProductionReport to sync
            sheet_id: Target sheet ID
            update_existing: If True, updates existing row if found by run_id

        Returns:
            Sync result with row ID and status
        """
        logger.info(
            "sync_started",
            report_id=report.id,
            run_id=report.header.run_id,
            sheet_id=sheet_id
        )

        try:
            # Convert report to row data
            row_data = self.mapping.map_report_to_row(report)

            # Check if row already exists (by run_id)
            existing_row = None
            run_id_column = self.mapping.header_mapping.get("run_id", "Run ID")

            if update_existing:
                existing_row = self.client.find_row_by_value(
                    sheet_id,
                    run_id_column,
                    report.header.run_id
                )

            if existing_row:
                # Update existing row
                result = self.client.update_row(
                    sheet_id,
                    existing_row["id"],
                    row_data
                )
                operation = "updated"
            else:
                # Add new row
                result = self.client.add_row(sheet_id, row_data)
                operation = "created"

            # Log for audit
            audit_logger.log_integration(
                target_system="smartsheets",
                operation=operation,
                record_id=report.header.run_id,
                success=result.get("success", False),
                details={
                    "sheet_id": sheet_id,
                    "row_id": result.get("row_id"),
                    "report_id": report.id
                }
            )

            logger.info(
                "sync_completed",
                report_id=report.id,
                operation=operation,
                row_id=result.get("row_id")
            )

            return {
                "success": True,
                "operation": operation,
                "row_id": result.get("row_id"),
                "run_id": report.header.run_id,
                "sheet_id": sheet_id
            }

        except Exception as e:
            logger.error(
                "sync_failed",
                report_id=report.id,
                error=str(e)
            )

            audit_logger.log_integration(
                target_system="smartsheets",
                operation="sync",
                record_id=report.header.run_id,
                success=False,
                details={"error": str(e)}
            )

            return {
                "success": False,
                "error": str(e),
                "run_id": report.header.run_id
            }

    def batch_sync_reports(
        self,
        reports: list[ProductionReport],
        sheet_id: int
    ) -> dict:
        """
        Sync multiple reports in batch

        Args:
            reports: List of ProductionReports
            sheet_id: Target sheet ID

        Returns:
            Batch sync result
        """
        results = []
        success_count = 0
        error_count = 0

        for report in reports:
            result = self.sync_production_report(report, sheet_id)
            results.append(result)

            if result["success"]:
                success_count += 1
            else:
                error_count += 1

        return {
            "total": len(reports),
            "success_count": success_count,
            "error_count": error_count,
            "results": results
        }

    def get_sync_status(self, sheet_id: int, run_id: str) -> dict:
        """
        Check if a run_id exists in the sheet

        Args:
            sheet_id: Sheet to check
            run_id: Run ID to find

        Returns:
            Sync status info
        """
        run_id_column = self.mapping.header_mapping.get("run_id", "Run ID")
        existing = self.client.find_row_by_value(sheet_id, run_id_column, run_id)

        if existing:
            return {
                "synced": True,
                "row_id": existing["id"],
                "row_number": existing["row_number"],
                "last_values": existing["cells"]
            }
        else:
            return {
                "synced": False
            }
