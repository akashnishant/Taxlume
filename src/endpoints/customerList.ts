
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const AddressSchema = z.object({
    id: z.string(),
    address_type: z.string(),
    label: z.string().nullable(),
    address_line1: z.string(),
    address_line2: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    state_code: z.string().nullable(),
    pincode: z.string().nullable(),
    country: z.string(),
    is_default: z.number(),
});

export class CustomerList extends OpenAPIRoute {
    schema = {
        tags: ["Customers"],
        summary: "List customers",
        responses: {
            "200": {
                description: "Customers retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            customers: z.array(
                                z.object({
                                    id: z.string(),
                                    display_name: z.string(),
                                    legal_name: z.string().nullable(),
                                    gstin: z.string().nullable(),
                                    pan: z.string().nullable(),
                                    email: z.string().nullable(),
                                    phone: z.string().nullable(),
                                    contact_person: z.string().nullable(),
                                    payment_terms_days: z.number(),
                                    is_active: z.number(),
                                    created_at: z.string(),
                                    addresses: z.array(AddressSchema),
                                }),
                            ),
                        }),
                    },
                },
            },
            "401": {
                description: "Authentication required",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");

        const result = await c.env.DB
            .prepare(`
                SELECT
                    p.id,
                    p.display_name,
                    p.legal_name,
                    p.gstin,
                    p.pan,
                    p.email,
                    p.phone,
                    p.contact_person,
                    p.payment_terms_days,
                    p.is_active,
                    p.created_at
                FROM parties p
                INNER JOIN party_roles pr
                    ON pr.party_id = p.id
                WHERE p.company_id = ?
                    AND pr.role = 'CUSTOMER'
                ORDER BY p.is_active DESC, p.display_name ASC
            `)
            .bind(companyId)
            .all<{
                id: string;
                display_name: string;
                legal_name: string | null;
                gstin: string | null;
                pan: string | null;
                email: string | null;
                phone: string | null;
                contact_person: string | null;
                payment_terms_days: number;
                is_active: number;
                created_at: string;
            }>();

        const customers = result.results;

        if (customers.length === 0) {
            return {
                success: true,
                customers: [],
            };
        }

        const customerIds = customers.map((customer) => customer.id);
        const placeholders = customerIds.map(() => "?").join(", ");

        const addressResult = await c.env.DB
            .prepare(`
                SELECT
                    id,
                    party_id,
                    address_type,
                    label,
                    address_line1,
                    address_line2,
                    city,
                    state,
                    state_code,
                    pincode,
                    country,
                    is_default
                FROM party_addresses
                WHERE party_id IN (${placeholders})
                ORDER BY is_default DESC, created_at ASC
            `)
            .bind(...customerIds)
            .all<{
                id: string;
                party_id: string;
                address_type: string;
                label: string | null;
                address_line1: string;
                address_line2: string | null;
                city: string | null;
                state: string | null;
                state_code: string | null;
                pincode: string | null;
                country: string;
                is_default: number;
            }>();

        const addressesByCustomer = new Map<
            string,
            Array<{
                id: string;
                address_type: string;
                label: string | null;
                address_line1: string;
                address_line2: string | null;
                city: string | null;
                state: string | null;
                state_code: string | null;
                pincode: string | null;
                country: string;
                is_default: number;
            }>
        >();

        for (const address of addressResult.results) {
            const { party_id, ...addressData } = address;
            const existing = addressesByCustomer.get(party_id) ?? [];
            existing.push(addressData);
            addressesByCustomer.set(party_id, existing);
        }

        return {
            success: true,
            customers: customers.map((customer) => ({
                ...customer,
                addresses: addressesByCustomer.get(customer.id) ?? [],
            })),
        };
    }
}
