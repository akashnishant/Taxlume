export function getQuantityMilli(
  quantity: number,
): number {
  return Math.round(quantity * 1000);
}

export function getGrossPaise(
  quantity: number,
  ratePaise: number,
): number {
  const quantityMilli =
    getQuantityMilli(quantity);

  return Math.floor(
    (quantityMilli * ratePaise) / 1000,
  );
}

export function getTaxableAmountPaise(
  quantity: number,
  ratePaise: number,
  discountPaise: number,
): number {
  const grossPaise =
    getGrossPaise(
      quantity,
      ratePaise,
    );

  return Math.max(
    0,
    grossPaise - discountPaise,
  );
}

export function getGstPaise(
  taxableAmountPaise: number,
  gstRateBps: number,
): number {
  return Math.floor(
    (taxableAmountPaise * gstRateBps) /
      10000,
  );
}

export function getTodayDate(): string {
  const now = new Date();

  const year =
    now.getFullYear();

  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    now.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}