declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayCheckoutOptions,
    ) => RazorpayCheckoutInstance;
  }
}

export type RazorpayCheckoutSuccessResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id?: string;
  razorpay_signature?: string;
};

export type RazorpayCheckoutOptions = {
  key: string;
  subscription_id: string;

  name: string;
  description?: string;

  handler: (
    response: RazorpayCheckoutSuccessResponse,
  ) => void;

  modal?: {
    ondismiss?: () => void;
  };

  theme?: {
    color?: string;
  };
};

export type RazorpayCheckoutInstance = {
  open(): void;

  on?(
    event: string,
    handler: (response: unknown) => void,
  ): void;
};

let loadPromise:
  | Promise<void>
  | null = null;

export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<void>(
    (resolve, reject) => {
      const existingScript =
        document.querySelector<HTMLScriptElement>(
          'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
        );

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          () => resolve(),
          {
            once: true,
          },
        );

        existingScript.addEventListener(
          "error",
          () => {
            loadPromise = null;

            reject(
              new Error(
                "Unable to load Razorpay Checkout.",
              ),
            );
          },
          {
            once: true,
          },
        );

        return;
      }

      const script =
        document.createElement("script");

      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";

      script.async = true;

      script.onload = () => {
        resolve();
      };

      script.onerror = () => {
        loadPromise = null;

        reject(
          new Error(
            "Unable to load Razorpay Checkout.",
          ),
        );
      };

      document.body.appendChild(
        script,
      );
    },
  );

  return loadPromise;
}