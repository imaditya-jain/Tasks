import { useLoaderData, useFetcher, json } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Layout, Text, Card, Button, DataTable, Thumbnail, Modal, FormLayout, TextField, Frame, Toast } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";

export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
        `#graphql
      {
        products(first: 100) {
          edges {
            node {
              id
              title
              handle
              status
              images(first: 1) {
                edges {
                  node {
                    originalSrc
                    altText
                  }
                }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    price
                    barcode
                    createdAt
                  }
                }
              }
            }
          }
        }
      }`,
    );
    const responseJson = await response.json();
    return json(responseJson.data);
};

const Collections = () => {
    const data = useLoaderData();
    const fetcher = useFetcher();
    const products = data.products.edges;

    const [show, setShow] = useState(false)
    const [active, setActive] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [title, setTitle] = useState("")
    const [price, setPrice] = useState('')
    const [toastActive, setToastActive] = useState(false)
    const [isCreating, setISCreating] = useState(false)

    const handleModalChange = useCallback(() => setActive(!active), [active])
    const toggleToastActive = useCallback(() => setToastActive((active) => !active), [])

    useEffect(() => {
        if (typeof window !== "undefined") {
            setShow(true);
        }
    }, []);

    const handleEdit = (product) => {
        setISCreating(false)
        setEditingProduct(product)
        setTitle(product?.title)
        setPrice(product?.variants?.edges[0]?.node?.price || '')
        setActive(true)
    }

    const handleDelete = async (productId) => {
        await fetcher.submit(
            { productId },
            { method: "DELETE", action: "/app/products/delete" }
        );
    };

    const handleCreate = () => {
        setEditingProduct(null)
        setISCreating(true)
        setTitle('')
        setPrice('')
        setActive(true)
    }

    const handleSave = async () => {
        const formData = new FormData();
        formData.append("title", title);
        formData.append("price", price);

        if (!isCreating) {
            formData.append("id", editingProduct.id);
            formData.append("variantId", editingProduct.variants.edges[0]?.node.id);
            await fetcher.submit(formData, { method: "POST", action: "/app/products/edit" });
        } else {
            await fetcher.submit(formData, { method: "POST", action: "/app/products/create" });
        }
    };

    useEffect(() => {
        if (fetcher.state === 'idle') {
            if (fetcher.data?.success) {
                setToastActive(true)
                setActive(false)
                fetcher.load('/app/products')
            } else if (fetcher.data?.errors) {
                console.error(fetcher.data?.errors)
            }
        }
    }, [fetcher])

    const rows = products && products !== null && products !== undefined && products !== "" && Array.isArray(products) && products.length > 0 && products.reverse().map(({ node: product }) => [
        <Thumbnail source={product.images.edges[0]?.node.originalSrc || ""} alt={product.images.edges[0]?.node.altText || "Product Image"} />,
        product.title,
        product.status,
        product.variants.edges[0]?.node.price || "",
        <Button onClick={() => handleEdit(product)}>Edit</Button>,
        <Button destructive onClick={() => handleDelete(product.id)}>Delete</Button>,
    ]);

    const isLoading = fetcher.state === 'submitting'

    return <>
        {
            show && (
                <Frame>
                    <Page fullWidth primaryAction={{
                        content: "Create Product",
                        onAction: handleCreate
                    }}>
                        <Layout>
                            <Layout.Section>
                                <Card>
                                    <Text as="h2" variant="headingMd">
                                        Products List
                                    </Text>
                                    <DataTable
                                        columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                                        headings={["Image", "Title", "Status", "Price", "Edit", "Delete"]}
                                        rows={rows}
                                    />
                                </Card>
                            </Layout.Section>
                        </Layout>

                        <Modal
                            open={active}
                            onClose={handleModalChange}
                            title={isCreating ? 'Create Product' : "Edit Product"}
                            primaryAction={{
                                content: 'Save',
                                onAction: handleSave,
                                loading: isLoading
                            }}
                            secondaryActions={[
                                {
                                    content: 'Cancel',
                                    onAction: handleModalChange
                                }
                            ]}

                        >
                            <Modal.Section>
                                <FormLayout>
                                    <TextField label="Title" value={title} onChange={(value) => setTitle(value)} />
                                    <TextField label="Price" value={price} onChange={(value) => setPrice(value)} />
                                </FormLayout>
                            </Modal.Section>
                        </Modal>
                        )
                        {
                            toastActive && (
                                <Toast content="Product updated successfully." onDismiss={toggleToastActive} />
                            )
                        }
                    </Page>
                </Frame>
            )
        }
    </>;
};

export default Collections;
