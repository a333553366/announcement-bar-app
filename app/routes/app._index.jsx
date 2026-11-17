import { useState, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Checkbox,
  Button,
  Banner,
  InlineGrid,
  Text,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  let shopName = "";
  let settings = {
    enabled: true,
    isMarquee: true,
    message: "Welcome to our store - customize this announcement in your app settings.",
    linkUrl: "",
    bgColor: "#111213",
    textColor: "#ffffff",
  };

  try {
    const response = await admin.graphql(
      `#graphql
        query getMetafieldAndShop {
          shop {
            name
          }
          currentAppInstallation {
            metafield(namespace: "announcement_bar", key: "settings") {
              value
            }
          }
        }`
    );

    const json = await response.json();
    shopName = json.data?.shop?.name || "";
    const rawValue = json.data?.currentAppInstallation?.metafield?.value;

    if (rawValue) {
      settings = { ...settings, ...JSON.parse(rawValue) };
    }
  } catch (error) {
    console.error("Failed to load metafield settings, using defaults:", error);
  }

  return { settings, shopName };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const settingsJson = formData.get("settings");

  try {
    const appDataResponse = await admin.graphql(
      `#graphql
        query getAppInstallationId {
          currentAppInstallation {
            id
          }
        }`
    );
    const appData = await appDataResponse.json();
    const ownerId = appData.data?.currentAppInstallation?.id;

    if (ownerId) {
      await admin.graphql(
        `#graphql
          mutation CreateAppDataMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafieldsSetInput) {
              metafields {
                id
                key
                namespace
                value
              }
              userErrors {
                field
                message
              }
            }
          }`,
        {
          variables: {
            metafieldsSetInput: [
              {
                namespace: "announcement_bar",
                key: "settings",
                type: "json",
                value: settingsJson,
                ownerId: ownerId,
              },
            ],
          },
        }
      );
    }
  } catch (error) {
    console.error("Failed to save metafield settings:", error);
  }

  return { success: true };
};

export default function Index() {
  const { settings: initialSettings, shopName } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [enabled, setEnabled] = useState(initialSettings.enabled ?? true);
  const [isMarquee, setIsMarquee] = useState(initialSettings.isMarquee ?? true);
  const [message, setMessage] = useState(
    initialSettings.message || "Welcome to our store - customize this announcement in your app settings."
  );
  const [linkUrl, setLinkUrl] = useState(initialSettings.linkUrl || "");
  const [bgColor, setBgColor] = useState(initialSettings.bgColor || "#111213");
  const [textColor, setTextColor] = useState(initialSettings.textColor || "#ffffff");
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (navigation.state === "idle" && navigation.formMethod === "POST") {
      setSavedBanner(true);
      const timer = setTimeout(() => setSavedBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [navigation.state, navigation.formMethod]);

  const handleSave = () => {
    const payload = {
      enabled,
      isMarquee,
      message,
      linkUrl,
      bgColor,
      textColor,
    };
    submit({ settings: JSON.stringify(payload) }, { method: "post" });
  };

  return (
    <Page
      title="Announcement Bar & Marquee"
      subtitle={shopName ? `Connected store: ${shopName} — Displayed at top of storefront` : undefined}
    >
      <BlockStack gap="500">
        {savedBanner && (
          <Banner tone="success" onDismiss={() => setSavedBanner(false)}>
            Settings saved successfully!
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  General Settings
                </Text>

                <Checkbox
                  label="Enable Announcement Bar"
                  checked={enabled}
                  onChange={(val) => setEnabled(val)}
                />

                <Checkbox
                  label="Enable Marquee Scrolling Animation"
                  checked={isMarquee}
                  onChange={(val) => setIsMarquee(val)}
                />

                <TextField
                  label="Announcement Message"
                  value={message}
                  onChange={(val) => setMessage(val)}
                  autoComplete="off"
                  multiline={2}
                />

                <TextField
                  label="Destination Link URL (Optional)"
                  value={linkUrl}
                  onChange={(val) => setLinkUrl(val)}
                  autoComplete="off"
                  placeholder="https://example.com/collections/sale"
                />

                <InlineGrid columns={2} gap="400">
                  <Box>
                    <TextField
                      label="Background Color (HEX)"
                      value={bgColor}
                      onChange={(val) => setBgColor(val)}
                      autoComplete="off"
                      prefix={
                        <input
                          type="color"
                          value={bgColor.startsWith("#") && bgColor.length === 7 ? bgColor : "#111213"}
                          onChange={(e) => setBgColor(e.target.value)}
                          style={{
                            width: "24px",
                            height: "24px",
                            padding: 0,
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                            background: "none",
                          }}
                        />
                      }
                    />
                  </Box>

                  <Box>
                    <TextField
                      label="Text Color (HEX)"
                      value={textColor}
                      onChange={(val) => setTextColor(val)}
                      autoComplete="off"
                      prefix={
                        <input
                          type="color"
                          value={textColor.startsWith("#") && textColor.length === 7 ? textColor : "#ffffff"}
                          onChange={(e) => setTextColor(e.target.value)}
                          style={{
                            width: "24px",
                            height: "24px",
                            padding: 0,
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                            background: "none",
                          }}
                        />
                      }
                    />
                  </Box>
                </InlineGrid>

                <Box paddingBlockStart="200">
                  <Button variant="primary" loading={isSaving} onClick={handleSave}>
                    Save Settings
                  </Button>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  Live Preview (Top Bar)
                </Text>

                <style>{`
                  @keyframes marqueeScroll {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                  }
                `}</style>

                <div
                  style={{
                    backgroundColor: bgColor,
                    color: textColor,
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    overflow: "hidden",
                    position: "relative",
                    textAlign: isMarquee ? "left" : "center",
                  }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      whiteSpace: "nowrap",
                      animation: isMarquee ? "marqueeScroll 12s linear infinite" : "none",
                      width: isMarquee ? "auto" : "100%",
                      wordBreak: isMarquee ? "normal" : "break-word",
                    }}
                  >
                    {message || "Announcement preview text here..."}
                  </div>
                </div>

                <Text variant="bodySm" tone="subdued">
                  {enabled
                    ? isMarquee
                      ? "Status: Active (Scrolling Marquee at Top)"
                      : "Status: Active (Static Display at Top)"
                    : "Status: Disabled"}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
