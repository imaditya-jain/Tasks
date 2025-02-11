import { json } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const productId = formData.get("id");
    const title = formData.get("title");
    const variantId = formData.get("variantId");
    const price = formData.get("price");

    try {
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice)) {
            return json({ errors: [{ field: "price", message: "Invalid price value" }] }, { status: 400 });
        }

        const productResponse = await admin.graphql(
            `#graphql
            mutation productUpdate($input: ProductInput!) {
                productUpdate(input: $input) {
                    product {
                        id
                        title
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }`,
            {
                variables: {
                    input: {
                        id: productId,
                        title,
                    },
                },
            }
        );

        if (productResponse.data?.productUpdate?.userErrors.length) {
            return json({ errors: productResponse.data.productUpdate.userErrors }, { status: 400 });
        }
        const variantResponse = await admin.graphql(
            `#graphql
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            product {
                id
            }
            productVariants {
                id
                price
            }
            userErrors {
                field
                message
            }
        }
    }`,
            {
                variables: {
                    productId,
                    variants: [
                        {
                            id: variantId,
                            price: parsedPrice.toFixed(2),
                        },
                    ],
                },
            }
        );

        if (variantResponse.data?.productVariantsBulkUpdate?.userErrors.length) {
            return json({ errors: variantResponse.data.productVariantsBulkUpdate.userErrors }, { status: 400 });
        }


        return json({ success: true });
    } catch (error) {
        console.error("Unexpected error:", error);
        return json({ errors: [{ message: error.message }] }, { status: 500 });
    }
};
