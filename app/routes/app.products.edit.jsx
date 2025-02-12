import { json } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const productId = formData.get("id");
    const title = formData.get("title");
    const descriptionHtml = formData.get("description");
    const vendor = formData.get("vendor");
    const imageSrc = formData.get("image");
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
                        descriptionHtml
                        vendor
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
                        descriptionHtml,
                        vendor,
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

        if (imageSrc) {
            const imageResponse = await admin.graphql(
                `#graphql
        mutation productUpdate($input: ProductInput!, $media: [CreateMediaInput!]) {
            productUpdate(input: $input, media: $media) {
                product {
                    id
                    featuredMedia {
                        preview {
                            image {
                                url
                            }
                        }
                    }
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
                        },
                        media: [
                            {
                                originalSource: imageSrc,
                                alt: title,
                                mediaContentType: "IMAGE",
                            },
                        ],
                    },
                }
            );

            if (imageResponse.data?.productUpdate?.userErrors.length) {
                return json({ errors: imageResponse.data.productUpdate.userErrors }, { status: 400 });
            }
        }





        return json({ success: true });
    } catch (error) {
        console.error("Unexpected error:", error);
        return json({ errors: [{ message: error.message }] }, { status: 500 });
    }
};
