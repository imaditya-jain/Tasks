import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const title = formData.get("title");
    const descriptionHtml = formData.get("description");
    const vendor = formData.get("vendor");
    const imageSrc = formData.get("image");
    const price = formData.get("price");

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice)) {
      return json({ errors: [{ field: "price", message: "Invalid price value" }] }, { status: 400 });
    }

    const productResponse = await admin.graphql(
      `#graphql
      mutation productCreate($product: ProductCreateInput!) {
          productCreate(product: $product) {
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
          product: {
            title,
            descriptionHtml,
            vendor,
            status: "ACTIVE",
            productType: "General",
            tags: ["New"],
          },
        },
      }
    );

    if (!productResponse?.productCreate?.product) {
      throw new Error("Invalid response from Shopify API");
    }

    if (productResponse.productCreate.userErrors.length) {
      return json({ errors: productResponse.productCreate.userErrors }, { status: 400 });
    }

    const productId = productResponse.productCreate.product.id;
    console.log("Product Created: ", productId);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const variantResponse = await admin.graphql(
      `#graphql
      mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkCreate(productId: $productId, variants: $variants) {
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
              price: parsedPrice.toFixed(2),
            },
          ],
        },
      }
    );

    if (!variantResponse?.productVariantsBulkCreate?.productVariants) {
      throw new Error("Invalid response from Shopify API for variant update");
    }

    if (variantResponse.productVariantsBulkCreate.userErrors.length) {
      return json({ errors: variantResponse.productVariantsBulkCreate.userErrors }, { status: 400 });
    }

    console.log("Variants Created");

    if (imageSrc) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const imageResponse = await admin.graphql(
        `#graphql
        mutation productSet($id: ID!, $media: [CreateMediaInput!]!) {
            productSet(id: $id, media: $media) {
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
                mediaUserErrors {
                    field
                    message
                }
            }
        }`,
        {
          variables: {
            id: productId,
            media: [
              {
                url: imageSrc,
                alt: title,
                mediaContentType: "IMAGE",
              },
            ],
          },
        }
      );

      if (!imageResponse?.productSet?.product) {
        throw new Error("Invalid response from Shopify API for image upload");
      }

      if (imageResponse.productSet.mediaUserErrors.length) {
        return json({ errors: imageResponse.productSet.mediaUserErrors }, { status: 400 });
      }
    }

    console.log("Product fully created");
    return json({ success: true, productId });
  } catch (error) {
    console.error("Error:", error);
    return json({ errors: [{ message: error.message }] }, { status: 500 });
  }
};
