export type DocumentFormItem = {
  id: string;
  productId: string;
  quantity: number;
  ratePaise: number;
  discountPaise: number;
  gstRateBps: number;

  // Optional item details copied from an existing source document.
  itemName?: string;
  description?: string;
  hsnSac?: string;
  unit?: string;
  cessRateBps?: number;
};
