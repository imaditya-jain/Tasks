import { json } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const productId = formData.get("productId");

    const response = await admin.graphql(
        `#graphql
        mutation deleteProduct($input: ProductDeleteInput!) {
            productDelete(input: $input) {
                deletedProductId  # Correct field name
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
                },
            },
        }
    );

    const responseData = await response.json();

    if (responseData.data.productDelete.userErrors.length > 0) {
        return json({ success: false, errors: responseData.data.productDelete.userErrors });
    }

    return json({ success: true });
};
