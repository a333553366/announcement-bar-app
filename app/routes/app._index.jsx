import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import {
  authenticate,
  MONTHLY_PLAN,
  ANNUAL_PLAN,
} from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);

  let hasActivePayment = false;
  let settings = {
    enabled: true,
    message: "Welcome to our store — customize this announcement in your app settings.",
    bgColor: "#000000",
    textColor: "#ffffff",
    speed: "normal",
  };

  // 1. 正式订阅检查（isTest: false 走真实生产环境扣费检查）
  try {
    if (billing && typeof billing.check === "function") {
      const billingCheck = await billing.check({
        plans: [MONTHLY_PLAN, ANNUAL_PLAN],
        isTest: false, 
      });
      hasActivePayment = Boolean(billingCheck?.hasActivePayment);
    }
  } catch (billingErr) {
    console.warn("Billing check bypassed:", billingErr?.message || billingErr);
  }

  // 2. 查询 Metafield 设置
  try {
    const response = await admin.graphql(`
      #graphql
      query getMarqueeSettings {
        currentAppInstallation {
          metafield(namespace: "announcement_marquee", key: "settings") {
            value
          }
        }
      }
    `);

    const resJson = await response.json();
    const rawValue = resJson?.data?.currentAppInstallation?.metafield?.value;
    if (rawValue) {
      settings = { ...settings, ...JSON.parse(rawValue) };
    }
  } catch (err) {
    console.error("GraphQL query error:", err);
  }

  return Response.json({ settings, hasActivePayment });
};

export const action = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  // 1. 发起正式订阅请求（isTest: false）
  if (actionType === "subscribe") {
    try {
      const planType = formData.get("planType");
      const selectedPlan = planType === "annual" ? ANNUAL_PLAN : MONTHLY_PLAN;
      const returnUrl = `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`;

      await billing.request({
        session,
        plan: selectedPlan,
        isTest: false, // 正式上线版：关闭测试模式，触发真实扣费
        returnUrl,
      });
    } catch (error) {
      if (error instanceof Response) {
        const redirectUrl =
          error.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url") ||
          error.headers.get("Location");

        if (redirectUrl) {
          return Response.json({ confirmationUrl: redirectUrl });
        }
        throw error;
      }
      throw error;
    }
  }

  // 2. 保存公告栏配置
  try {
    const payload = {
      enabled: formData.get("enabled") === "true",
      message: formData.get("message") || "Welcome to our store",
      bgColor: formData.get("bgColor") || "#000000",
      textColor: formData.get("textColor") || "#ffffff",
      speed: formData.get("speed") || "normal",
    };

    const appRes = await admin.graphql(`
      #graphql
      query getAppInstallationId {
        currentAppInstallation {
          id
        }
      }
    `);
    const appData = await appRes.json();
    const ownerId = appData?.data?.currentAppInstallation?.id;

    if (ownerId) {
      const setResult = await admin.graphql(
        `#graphql
        mutation setMarqueeSettings($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              key
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
            metafields: [
              {
                ownerId: ownerId,
                namespace: "announcement_marquee",
                key: "settings",
                type: "json",
                value: JSON.stringify(payload),
              },
            ],
          },
        }
      );
      const setJson = await setResult.json();
      const userErrors = setJson?.data?.metafieldsSet?.userErrors;
      if (userErrors && userErrors.length > 0) {
        return Response.json({ success: false, error: userErrors[0].message });
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, error: err?.message });
  }
};

export default function MarqueeIndex() {
  const { settings, hasActivePayment } = useLoaderData();
  const fetcher = useFetcher();

  const [enabled, setEnabled] = useState(Boolean(settings?.enabled ?? true));
  const [message, setMessage] = useState(settings?.message || "");
  const [bgColor, setBgColor] = useState(settings?.bgColor || "#000000");
  const [textColor, setTextColor] = useState(settings?.textColor || "#ffffff");
  const [speed, setSpeed] = useState(settings?.speed || "normal");

  const [toastMsg, setToastMsg] = useState("");

  const isSaving =
    fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "save";
  const submittingPlan =
    fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "subscribe"
      ? fetcher.formData?.get("planType")
      : null;

  useEffect(() => {
    if (fetcher.data?.success) {
      setToastMsg("Settings successfully saved!");
      const timer = setTimeout(() => setToastMsg(""), 3500);
      return () => clearTimeout(timer);
    } else if (fetcher.data?.error) {
      setToastMsg(`Error saving settings: ${fetcher.data.error}`);
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (fetcher.data?.confirmationUrl) {
      if (window.top) {
        window.top.location.href = fetcher.data.confirmationUrl;
      } else {
        window.location.href = fetcher.data.confirmationUrl;
      }
    }
  }, [fetcher.data]);

  const handleSave = () => {
    const data = new FormData();
    data.append("actionType", "save");
    data.append("enabled", String(enabled));
    data.append("message", message);
    data.append("bgColor", bgColor);
    data.append("textColor", textColor);
    data.append("speed", speed);

    fetcher.submit(data, { method: "post" });
  };

  const handleSubscribe = (planType) => {
    const data = new FormData();
    data.append("actionType", "subscribe");
    data.append("planType", planType);

    fetcher.submit(data, { method: "post" });
  };

  const textInputStyle = {
    flex: 1,
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #c9cccf",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const colorInputStyle = {
    width: "42px",
    height: "36px",
    border: "none",
    cursor: "pointer",
    background: "none",
  };

  return (
    <div style={{ padding: "32px", minHeight: "100vh", backgroundColor: "#f6f6f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#202223" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 4px 0" }}>Announcement Marquee</h1>
            <p style={{ fontSize: "13px", color: "#6d7175", margin: 0 }}>Configure your scrolling announcement bar.</p>
          </div>
          <button 
            type="button"
            onClick={handleSave} 
            disabled={isSaving}
            style={{ 
              backgroundColor: isSaving ? "#8c9196" : "#008060", 
              color: "#ffffff", 
              border: "none", 
              padding: "10px 24px", 
              borderRadius: "6px", 
              fontSize: "14px", 
              fontWeight: "600", 
              cursor: isSaving ? "not-allowed" : "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {toastMsg && (
          <div style={{ padding: "12px 16px", backgroundColor: fetcher.data?.error ? "#fbeae5" : "#e3f1df", border: `1px solid ${fetcher.data?.error ? "#e0b3b2" : "#9bc995"}`, borderRadius: "6px", marginBottom: "20px", color: fetcher.data?.error ? "#bf0711" : "#1a5e18", fontSize: "14px", fontWeight: "500" }}>
            {toastMsg}
          </div>
        )}

        {/* 计费套餐展示区 */}
        <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasActivePayment ? "0" : "18px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>Subscription Plan</h2>
                <span style={{ 
                  backgroundColor: hasActivePayment ? "#c3e6cb" : "#e4e5e7", 
                  color: hasActivePayment ? "#155724" : "#202223", 
                  fontSize: "11px", 
                  fontWeight: "600", 
                  padding: "2px 8px", 
                  borderRadius: "10px",
                }}>
                  {hasActivePayment ? "Pro Active" : "Free Plan"}
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "#6d7175", margin: 0 }}>
                {hasActivePayment 
                  ? "Your Pro subscription is active." 
                  : "Upgrade to Pro to unlock advanced marquee styles and priority support."}
              </p>
            </div>
          </div>

          {!hasActivePayment && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <div style={{ border: "1px solid #e1e3e5", borderRadius: "6px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 6px 0" }}>Monthly Plan</h3>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#202223", marginBottom: "6px" }}>
                    $39 <span style={{ fontSize: "13px", color: "#6d7175", fontWeight: "normal" }}>/ month</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#6d7175", margin: 0 }}>Billed every 30 days. Cancel anytime.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSubscribe("monthly")}
                  disabled={Boolean(submittingPlan)}
                  style={{ marginTop: "16px", backgroundColor: "#008060", color: "#ffffff", border: "none", padding: "9px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                >
                  {submittingPlan === "monthly" ? "Redirecting..." : "Subscribe Monthly ($39/mo)"}
                </button>
              </div>

              <div style={{ border: "2px solid #008060", borderRadius: "6px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", backgroundColor: "#fbfdfa" }}>
                <span style={{ position: "absolute", top: "-10px", right: "12px", backgroundColor: "#008060", color: "#ffffff", fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px", textTransform: "uppercase" }}>
                  Save ~38%
                </span>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 6px 0" }}>Annual Plan</h3>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#202223", marginBottom: "6px" }}>
                    $289 <span style={{ fontSize: "13px", color: "#6d7175", fontWeight: "normal" }}>/ year</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#6d7175", margin: 0 }}>$24.08/mo equivalent. Billed once per year.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSubscribe("annual")}
                  disabled={Boolean(submittingPlan)}
                  style={{ marginTop: "16px", backgroundColor: "#008060", color: "#ffffff", border: "none", padding: "9px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                >
                  {submittingPlan === "annual" ? "Redirecting..." : "Subscribe Annual ($289/yr)"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 实时预览区 */}
        <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5", marginBottom: "24px" }}>
          <h3 style={{ fontSize: "12px", fontWeight: "700", margin: "0 0 12px 0", color: "#6d7175", textTransform: "uppercase" }}>Live Preview</h3>
          <div style={{ backgroundColor: bgColor, color: textColor, padding: "12px 20px", borderRadius: "6px", overflow: "hidden", whiteSpace: "nowrap", fontWeight: "600", fontSize: "14px" }}>
            <span>{message || "Your announcement text here..."}</span>
          </div>
        </div>

        {/* 设置表单 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 16px 0" }}>Content Settings</h3>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: "16px", height: "16px" }} />
                Enable Announcement Bar
              </label>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Announcement Text</label>
              <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #c9cccf", fontSize: "14px", boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 16px 0" }}>Style & Colors</h3>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Background Color</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={colorInputStyle} />
                <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={textInputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Text Color</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={colorInputStyle} />
                <input type="text" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={textInputStyle} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}