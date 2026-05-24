import uuid
import logging
import xml.etree.ElementTree as ET
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from . import models

logger = logging.getLogger(__name__)

def enqueue_transaction(db: Session, transaction_id: uuid.UUID) -> models.TallySyncQueue:
    """
    Voucher Export map: Compiles transaction double-entry ledger items
    into TallyPrime Gateway XML Voucher formats and registers sync task.
    """
    transaction = db.query(models.FinancialTransaction).filter(
        models.FinancialTransaction.id == transaction_id
    ).first()
    if not transaction:
        raise ValueError("Financial Transaction for Tally Sync not located.")

    # Prevent duplicate sync rows
    existing = db.query(models.TallySyncQueue).filter(
        models.TallySyncQueue.financial_transaction_id == transaction_id
    ).first()
    if existing:
        return existing

    # Generate XML payload compatible with Tally import specifications
    xml_payload = generate_tally_voucher_xml(transaction)

    queue_item = models.TallySyncQueue(
        financial_transaction_id=transaction_id,
        sync_status="PENDING",
        retry_count=0,
        payload_xml=xml_payload
    )
    db.add(queue_item)
    db.flush()
    return queue_item

def generate_tally_voucher_xml(transaction: models.FinancialTransaction) -> str:
    """
    Generates Tally XML schema representing various Accounting Vouchers.
    """
    vch_type_mapping = {
        "AP_INVOICE": "Journal",
        "PAYMENT": "Payment",
        "DEBIT_NOTE": "Debit Note",
        "CREDIT_NOTE": "Credit Note",
        "TAX_ENTRY": "Journal",
        "RECEIPT": "Receipt",
        "JOURNAL": "Journal"
    }
    vch_type = vch_type_mapping.get(transaction.transaction_type, "Journal")
    date_str = transaction.transaction_date.strftime("%Y%m%d")

    # Start compilation XML Envelope structure
    envelope = ET.Element("ENVELOPE")
    
    header = ET.SubElement(envelope, "HEADER")
    tally_request = ET.SubElement(header, "TALLYREQUEST")
    tally_request.text = "Import Data"

    body = ET.SubElement(envelope, "BODY")
    import_data = ET.SubElement(body, "IMPORTDATA")
    
    request_desc = ET.SubElement(import_data, "REQUESTDESC")
    report_name = ET.SubElement(request_desc, "REPORTNAME")
    report_name.text = "Vouchers"
    
    static_variables = ET.SubElement(request_desc, "STATICVARIABLES")
    sv_company = ET.SubElement(static_variables, "SVCOMPANY")
    sv_company.text = "ERP Operational Integration Co."

    request_data = ET.SubElement(import_data, "REQUESTDATA")
    tally_message = ET.SubElement(request_data, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
    
    voucher = ET.SubElement(tally_message, "VOUCHER", {
        "VCHTYPE": vch_type,
        "ACTION": "Create",
        "OBJVIEW": "Accounting Voucher"
    })

    # Header parameters
    vch_date = ET.SubElement(voucher, "DATE")
    vch_date.text = date_str
    
    vch_num = ET.SubElement(voucher, "VOUCHERNUMBER")
    vch_num.text = transaction.transaction_number
    
    vch_ref = ET.SubElement(voucher, "REFERENCE")
    vch_ref.text = transaction.transaction_number

    vch_narr = ET.SubElement(voucher, "NARRATION")
    vch_narr.text = f"Voucher sync from operational ERP: {transaction.transaction_type} voucher."

    # Ledger entries
    for entry in transaction.ledger_entries:
        ledger_list = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        
        led_name = ET.SubElement(ledger_list, "LEDGERNAME")
        led_name.text = entry.account_name

        # Tally logic: Debits are deemed positive (Yes), Credits are negative (No)
        is_debit = entry.debit_amount > 0
        deemed = ET.SubElement(ledger_list, "ISDEEMEDPOSITIVE")
        deemed.text = "Yes" if is_debit else "No"

        # Tally imports expect Debit as a NEGATIVE number, Credit as a POSITIVE number
        amount_val = -entry.debit_amount if is_debit else entry.credit_amount
        amt = ET.SubElement(ledger_list, "AMOUNT")
        amt.text = f"{amount_val:.2f}"

    # Return XML as a formatted string
    return ET.tostring(envelope, encoding="utf-8").decode("utf-8")

def process_sync_queue(db: Session) -> Dict[str, Any]:
    """
    Simulates sync processes, sending voucher XML to Tally Prime's gateway.
    Updates sync rows upon confirmation or handles errors with retries.
    """
    pending = db.query(models.TallySyncQueue).filter(
        models.TallySyncQueue.sync_status == "PENDING"
    ).all()

    synced_count = 0
    failed_count = 0

    for item in pending:
        item.last_attempt_at = datetime.utcnow()
        item.retry_count += 1
        
        try:
            if item.retry_count >= 3:
                item.sync_status = "DEAD_LETTER"
                item.error_message = "Max retries exceeded for Tally sync."
                failed_count += 1
                continue

            # Operational baseline Tally synchronizer simulation logic
            # TallyPrime local gateway port is typically http://localhost:9000/
            logger.info(f"Tally Sync: Exporting XML payload for {item.financial_transaction.transaction_number}")
            
            # Simulated successful response 
            item.sync_status = "SYNCED"
            item.synced_at = datetime.utcnow()
            item.error_message = None
            synced_count += 1
        except Exception as e:
            item.sync_status = "FAILED"
            item.error_message = str(e)
            failed_count += 1
            logger.error(f"Tally sync error: {str(e)}")

    db.commit()
    return {
        "processed": len(pending),
        "synced": synced_count,
        "failed": failed_count
    }
