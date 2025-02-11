import { json } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const title = formData.get("title");
    let price = formData.get("price");

    try {
        if (!title || !price) {
            console.error("Validation Error: Title and price are required.");
            return json({ errors: [{ message: "Title and price are required." }] }, { status: 400 });
        }

        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            console.error("Invalid price value.");
            return json({ errors: [{ message: "Price must be a valid number greater than 0." }] }, { status: 400 });
        }

        const productResponse = await admin.graphql(
            `#graphql
            mutation createProduct($input: ProductInput!) {
                productCreate(input: $input) {
                    product {
                        id
                        title
                        variants(first: 1) {
                            edges {
                                node {
                                    id
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
                        title,
                        status: "ACTIVE"
                    },
                },
            }
        );

        const productData = await productResponse.json();
        console.log("Product Response:", JSON.stringify(productData, null, 2));

        if (!productData?.data?.productCreate?.product?.id) {
            console.error("Product creation failed:", productData?.data?.productCreate?.userErrors);
            return json({
                errors: productData?.data?.productCreate?.userErrors || [{ message: "Failed to create product." }],
            }, { status: 400 });
        }

        const productId = productData.data.productCreate.product.id;
        const variantId = productData.data.productCreate.product.variants.edges[0]?.node?.id;

        const variantResponse = await admin.graphql(
            `#graphql
            mutation updateProductVariant($input: ProductVariantInput!) {
                productVariantUpdate(input: $input) {
                    productVariant {
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
                    input: {
                        id: variantId,
                        price: parsedPrice.toFixed(2),
                        compareAtPrice: (parsedPrice + 10).toFixed(2)
                    }
                },
            }
        );

        const variantData = await variantResponse.json();
        console.log("Variant Update Response:", JSON.stringify(variantData, null, 2));

        if (variantData?.data?.productVariantUpdate?.userErrors?.length > 0) {
            console.error("Variant update failed:", variantData.data.productVariantUpdate.userErrors);
            return json({
                errors: variantData.data.productVariantUpdate.userErrors,
            }, { status: 400 });
        }

        const publishResponse = await admin.graphql(
            `#graphql
            mutation publishProduct($input: ProductPublishInput!) {
                productPublish(input: $input) {
                    product {
                        id
                        publishedAt
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
                },
            }
        );

        const publishData = await publishResponse.json();
        console.log("Publish Response:", JSON.stringify(publishData, null, 2));

        if (publishData?.data?.productPublish?.userErrors?.length > 0) {
            console.error("Product publish failed:", publishData.data.productPublish.userErrors);
            return json({
                errors: publishData.data.productPublish.userErrors,
            }, { status: 400 });
        }

        return json({
            success: true,
            productId,
            message: "Product created and published successfully with price"
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return json({ errors: [{ message: error.message }] }, { status: 500 });
    }
};