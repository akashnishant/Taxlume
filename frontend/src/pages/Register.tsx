import { useState } from "react";
import type { FormEvent } from "react";
import { Building2, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { register as registerAccount } from "../services/authApi";
import { gstStates } from "../constants/gstStates";
import ButtonLoadingContent from "../components/ButtonLoadingContent";

type RegisterForm = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;

  legalName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  companyEmail: string;
  phone: string;

  addressLine1: string;
  addressLine2: string;
  city: string;
  stateCode: string;
  pincode: string;
};

const emptyForm: RegisterForm = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",

  legalName: "",
  tradeName: "",
  gstin: "",
  pan: "",
  companyEmail: "",
  phone: "",

  addressLine1: "",
  addressLine2: "",
  city: "",
  stateCode: "",
  pincode: "",
};

function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (
    Array.isArray(data?.errors) &&
    typeof data.errors[0]?.message === "string"
  ) {
    return data.errors[0].message;
  }

  if (Array.isArray(data) && typeof data[0]?.message === "string") {
    return data[0].message;
  }

  return "Unable to create your account. Please check the details and try again.";
}

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterForm>(emptyForm);

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState("");

  function updateField(field: keyof RegisterForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    setError("");

    if (!form.fullName.trim()) {
      setError("Your name is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!form.legalName.trim()) {
      setError("Company legal name is required.");
      return;
    }

    if (!form.addressLine1.trim()) {
      setError("Business address is required.");
      return;
    }

    if (!form.city.trim()) {
      setError("City is required.");
      return;
    }

    if (!form.stateCode) {
      setError("State is required.");
      return;
    }

    if (!form.pincode.trim()) {
      setError("Pincode is required.");
      return;
    }

    const selectedState = gstStates.find(
      (state) => state.code === form.stateCode,
    );

    if (!selectedState) {
      setError("Please select a valid state.");
      return;
    }

    try {
      setIsLoading(true);

      await registerAccount({
        email: form.email.trim(),
        password: form.password,
        full_name: form.fullName.trim(),

        company: {
          legal_name: form.legalName.trim(),

          trade_name: form.tradeName.trim() || undefined,

          gstin: form.gstin.trim().toUpperCase() || undefined,

          pan: form.pan.trim().toUpperCase() || undefined,

          email: form.companyEmail.trim() || undefined,

          phone: form.phone.trim() || undefined,

          address_line1: form.addressLine1.trim(),

          address_line2: form.addressLine2.trim() || undefined,

          city: form.city.trim(),

          state: selectedState.name,

          state_code: selectedState.code,

          pincode: form.pincode.trim(),

          country: "India",

          currency_code: "INR",
        },
      });

      navigate("/login", {
        replace: true,
        state: {
          registrationSuccess: true,
        },
      });
    } catch (error: any) {
      setError(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const selectedState =
    gstStates.find((state) => state.code === form.stateCode) ?? null;

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

  const labelClass = "mb-2 block text-sm font-medium text-slate-700";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white shadow-lg">
            T
          </div>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">Taxlume</h1>

          <p className="mt-2 text-sm font-medium text-slate-600">
            Smart Billing for Growing Businesses
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-slate-900">
              Create your Taxlume account
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Set up your account and business details.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <section>
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Account details
              </h3>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className={labelClass}>
                    Full name *
                  </label>

                  <div className="relative">
                    <User
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="fullName"
                      value={form.fullName}
                      onChange={(event) =>
                        updateField("fullName", event.target.value)
                      }
                      autoComplete="name"
                      className={`${inputClass} pl-10`}
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className={labelClass}>
                    Login email *
                  </label>

                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      autoComplete="email"
                      className={`${inputClass} pl-10`}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password *
                  </label>

                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(event) =>
                        updateField("password", event.target.value)
                      }
                      autoComplete="new-password"
                      className={`${inputClass} pl-10 pr-11`}
                      placeholder="Minimum 8 characters"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className={labelClass}>
                    Confirm password *
                  </label>

                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(event) =>
                        updateField("confirmPassword", event.target.value)
                      }
                      autoComplete="new-password"
                      className={`${inputClass} pl-10 pr-11`}
                      placeholder="Enter password again"
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div className="border-t border-slate-200" />

            <section>
              <div className="mb-4 flex items-center gap-2">
                <Building2 size={19} className="text-slate-600" />

                <h3 className="text-base font-semibold text-slate-900">
                  Business details
                </h3>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="legalName" className={labelClass}>
                    Legal name *
                  </label>

                  <input
                    id="legalName"
                    value={form.legalName}
                    onChange={(event) =>
                      updateField("legalName", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Company / business legal name"
                  />
                </div>

                <div>
                  <label htmlFor="tradeName" className={labelClass}>
                    Trade name
                  </label>

                  <input
                    id="tradeName"
                    value={form.tradeName}
                    onChange={(event) =>
                      updateField("tradeName", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label htmlFor="gstin" className={labelClass}>
                    GSTIN
                  </label>

                  <input
                    id="gstin"
                    value={form.gstin}
                    onChange={(event) =>
                      updateField("gstin", event.target.value.toUpperCase())
                    }
                    maxLength={15}
                    className={inputClass}
                    placeholder="27ABCDE1234F1Z5"
                  />
                </div>

                <div>
                  <label htmlFor="pan" className={labelClass}>
                    PAN
                  </label>

                  <input
                    id="pan"
                    value={form.pan}
                    onChange={(event) =>
                      updateField("pan", event.target.value.toUpperCase())
                    }
                    maxLength={10}
                    className={inputClass}
                    placeholder="ABCDE1234F"
                  />
                </div>

                <div>
                  <label htmlFor="companyEmail" className={labelClass}>
                    Business email
                  </label>

                  <input
                    id="companyEmail"
                    type="email"
                    value={form.companyEmail}
                    onChange={(event) =>
                      updateField("companyEmail", event.target.value)
                    }
                    className={inputClass}
                    placeholder="accounts@company.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Business phone
                  </label>

                  <input
                    id="phone"
                    value={form.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Business phone number"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="addressLine1" className={labelClass}>
                    Address line 1 *
                  </label>

                  <input
                    id="addressLine1"
                    value={form.addressLine1}
                    onChange={(event) =>
                      updateField("addressLine1", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Building, street, area"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="addressLine2" className={labelClass}>
                    Address line 2
                  </label>

                  <input
                    id="addressLine2"
                    value={form.addressLine2}
                    onChange={(event) =>
                      updateField("addressLine2", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Landmark, locality, etc."
                  />
                </div>

                <div>
                  <label htmlFor="city" className={labelClass}>
                    City *
                  </label>

                  <input
                    id="city"
                    value={form.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Mumbai"
                  />
                </div>

                <div>
                  <label htmlFor="state" className={labelClass}>
                    State / Union Territory *
                  </label>

                  <select
                    id="state"
                    value={form.stateCode}
                    onChange={(event) =>
                      updateField("stateCode", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select state</option>

                    {gstStates.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="stateCode" className={labelClass}>
                    GST State Code
                  </label>

                  <input
                    id="stateCode"
                    value={selectedState?.code ?? ""}
                    readOnly
                    className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
                    placeholder="Auto"
                  />
                </div>

                <div>
                  <label htmlFor="pincode" className={labelClass}>
                    Pincode *
                  </label>

                  <input
                    id="pincode"
                    value={form.pincode}
                    onChange={(event) =>
                      updateField("pincode", event.target.value)
                    }
                    className={inputClass}
                    placeholder="400001"
                  />
                </div>
              </div>
            </section>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">
                Creating an account does not activate a subscription. You will
                choose your Taxlume billing plan after registration.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center justify-center"
            >
              {isLoading ? (
                <ButtonLoadingContent message="Creating account..." />
              ) : (
                "Create Taxlume account"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-slate-900 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Taxlume
        </p>
      </div>
    </div>
  );
}
