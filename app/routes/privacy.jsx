export const meta = () => {
  return [
    { title: "Privacy Policy - Announcement Bar Marquee" },
    { name: "description", content: "Privacy Policy for Announcement Bar Marquee Shopify App" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", lineHeight: "1.6", color: "#333" }}>
      <h1 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Privacy Policy</h1>
      <p style={{ color: "#666" }}>Last updated: October 26, 2026</p>

      <h2>1. Overview</h2>
      <p>
        Announcement Bar Marquee (&quot;the App&quot;) provides customizable announcement bars and scrolling marquee banners for Shopify merchants. We are committed to protecting the privacy and security of your store and customer data.
      </p>

      <h2>2. Information We Collect</h2>
      <p>
        When you install the App, we only access information strictly necessary to provide the service:
      </p>
      <ul>
        <li><strong>Merchant Information:</strong> Store domain, email, and access tokens for API authorization.</li>
        <li><strong>Storefront Data:</strong> Basic configuration settings (such as announcement text, destination links, colors, and animation toggles) stored via Shopify metafields.</li>
        <li><strong>Customer Data:</strong> The App does not collect, track, sell, or store personally identifiable information (PII) of your store visitors or customers.</li>
      </ul>

      <h2>3. How We Use Information</h2>
      <p>
        We use the collected store details solely to authenticate the App, store your announcement banner preferences, and render the marquee bar on your storefront.
      </p>

      <h2>4. Data Retention and Deletion</h2>
      <p>
        We honor Shopify compliance standards, including mandatory data privacy webhooks:
      </p>
      <ul>
        <li>When a customer or merchant requests data deletion, we purge all associated metadata within the required timeframes.</li>
        <li>When you uninstall the App, your store access tokens and settings are removed from our active database.</li>
      </ul>

      <h2>5. Contact Us</h2>
      <p>
        If you have questions or concerns about this privacy policy, please contact our support team at:
        <br />
        <strong>Email:</strong> support@announcementbarmarquee.com
      </p>
    </div>
  );
}