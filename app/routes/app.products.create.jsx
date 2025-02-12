import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const CREATE_PRODUCT_MUTATION = `
  mutation ProductCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const PRODUCT_SET_MUTATION = `
  mutation ProductSet($productId: ID!, $media: [CreateMediaInput!]!) {
    productSet(id: $productId, media: $media) {
      product {
        id
      }
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

const VARIANT_BULK_CREATE_MUTATION = `
  mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantInput!]!) {
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
  }
`;

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const title = formData.get("title");
  const description = formData.get("description");
  const vendor = formData.get("vendor");
  const imageUrl = formData.get("image");
  const price = formData.get("price");

  console.log("Executing GraphQL request...");

  const productResponse = await admin.graphql(CREATE_PRODUCT_MUTATION, {
    variables: {
      input: {
        title,
        descriptionHtml: description,
        vendor,
        status: "ACTIVE",
      },
    },
  });


  if (!productResponse || !productResponse.productCreate) {
    return json({ error: productResponse.errors, response: productResponse }, { status: 500 });
  }

  const { productCreate } = productResponse;

  if (productCreate.userErrors?.length) {
    return json({ error: productCreate.userErrors }, { status: 400 });
  }

  const productId = productCreate.product?.id;

  if (!productId) {
    return json({ error: "Product creation failed, no product ID returned" }, { status: 500 });
  }


  if (imageUrl) {
    console.log("Uploading image...");

    const imageResponse = await admin.graphql(PRODUCT_SET_MUTATION, {
      variables: { productId, media: [{ alt: title, mediaContentType: "IMAGE", url: imageUrl }] },
    });

    console.log("Image upload response:", JSON.stringify(imageResponse, null, 2));

    if (imageResponse.mediaUserErrors?.length) {
      return json({ error: imageResponse.mediaUserErrors }, { status: 400 });
    }
  }


  const variantResponse = await admin.graphql(VARIANT_BULK_CREATE_MUTATION, {
    variables: { productId, variants: [{ price }] },
  });

  console.log("Variant creation response:", JSON.stringify(variantResponse, null, 2));

  if (variantResponse.userErrors?.length) {
    return json({ error: variantResponse.userErrors }, { status: 400 });
  }

  console.log("Product fully created!");

  return json({ success: true, productId });
}
