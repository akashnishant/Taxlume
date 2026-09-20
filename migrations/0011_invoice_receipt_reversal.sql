PRAGMA foreign_keys = ON;

-- Receipts are historical records. The only permitted update
-- is changing a RECORDED receipt to REVERSED while supplying
-- reversal metadata. Original payment details remain immutable.
CREATE TRIGGER invoice_receipts_validate_reversal
BEFORE UPDATE ON invoice_receipts
FOR EACH ROW
BEGIN
    SELECT (CASE
        WHEN OLD.status <> 'RECORDED'
          OR NEW.status <> 'REVERSED'
          OR NEW.id IS NOT OLD.id
          OR NEW.company_id IS NOT OLD.company_id
          OR NEW.document_id IS NOT OLD.document_id
          OR NEW.amount_paise IS NOT OLD.amount_paise
          OR NEW.payment_date IS NOT OLD.payment_date
          OR NEW.payment_method IS NOT OLD.payment_method
          OR NEW.reference_number IS NOT OLD.reference_number
          OR NEW.notes IS NOT OLD.notes
          OR NEW.created_by IS NOT OLD.created_by
          OR NEW.created_at IS NOT OLD.created_at
          OR NEW.reversed_by IS NULL
          OR NEW.reversed_at IS NULL
          OR NEW.reversal_reason IS NULL
          OR length(trim(NEW.reversal_reason)) = 0
          OR length(NEW.reversal_reason) > 500
        THEN RAISE(
            ABORT,
            'Invalid receipt reversal. Original payment details cannot be changed.'
        )
    END);

    SELECT (CASE
        WHEN NOT EXISTS (
            SELECT 1
            FROM documents d
            WHERE d.id = OLD.document_id
              AND d.company_id = OLD.company_id
              AND d.document_type = 'TAX_INVOICE'
              AND d.status = 'ISSUED'
              AND d.amount_paid_paise >= OLD.amount_paise
        )
        THEN RAISE(
            ABORT,
            'Invoice is not eligible for receipt reversal.'
        )
    END);
END;

-- Reversing the receipt and restoring the outstanding balance
-- occur as part of the same SQL operation.
CREATE TRIGGER invoice_receipts_apply_reversal
AFTER UPDATE OF status ON invoice_receipts
FOR EACH ROW
WHEN OLD.status = 'RECORDED'
 AND NEW.status = 'REVERSED'
BEGIN
    UPDATE documents
    SET amount_paid_paise = amount_paid_paise - OLD.amount_paise,
        updated_at = NEW.reversed_at
    WHERE id = OLD.document_id
      AND company_id = OLD.company_id;
END;

-- Do not allow receipt history to be erased.
CREATE TRIGGER invoice_receipts_prevent_delete
BEFORE DELETE ON invoice_receipts
FOR EACH ROW
BEGIN
    SELECT RAISE(
        ABORT,
        'Receipt history cannot be deleted.'
    );
END;