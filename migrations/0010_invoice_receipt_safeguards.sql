-- A receipt may be recorded only against an issued tax invoice
-- belonging to the same company, with enough balance remaining.
CREATE TRIGGER invoice_receipts_validate_insert
BEFORE INSERT ON invoice_receipts
FOR EACH ROW
BEGIN
    SELECT (CASE
        WHEN NEW.status <> 'RECORDED'
        THEN RAISE(
            ABORT,
            'New receipts must have RECORDED status.'
        )
    END);

    SELECT (CASE
        WHEN NOT EXISTS (
            SELECT 1
            FROM documents d
            WHERE d.id = NEW.document_id
              AND d.company_id = NEW.company_id
              AND d.document_type = 'TAX_INVOICE'
              AND d.status = 'ISSUED'
              AND NEW.amount_paise > 0
              AND d.amount_paid_paise >= 0
              AND d.amount_paid_paise <= d.total_paise
              AND NEW.amount_paise <= (
                  d.total_paise - d.amount_paid_paise
              )
        )
        THEN RAISE(
            ABORT,
            'Invoice is not eligible for this receipt or has insufficient outstanding balance.'
        )
    END);
END;

-- The receipt insert and the invoice balance update occur
-- within the same SQL operation.
CREATE TRIGGER invoice_receipts_apply_insert
AFTER INSERT ON invoice_receipts
FOR EACH ROW
BEGIN
    UPDATE documents
    SET amount_paid_paise = amount_paid_paise + NEW.amount_paise,
        updated_at = NEW.created_at
    WHERE id = NEW.document_id
      AND company_id = NEW.company_id;
END;

-- Until a refund/correction workflow exists, do not allow
-- an issued tax invoice with recorded payment history
-- to be cancelled.
CREATE TRIGGER prevent_paid_invoice_cancellation
BEFORE UPDATE OF status ON documents
FOR EACH ROW
WHEN OLD.document_type = 'TAX_INVOICE'
 AND OLD.status = 'ISSUED'
 AND NEW.status = 'CANCELLED'
BEGIN
    SELECT (CASE
        WHEN OLD.amount_paid_paise > 0
          OR EXISTS (
              SELECT 1
              FROM invoice_receipts r
              WHERE r.document_id = OLD.id
                AND r.company_id = OLD.company_id
          )
        THEN RAISE(
            ABORT,
            'This invoice has recorded payments and cannot be cancelled.'
        )
    END);
END;