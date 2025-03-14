
const Whitelist = require("../models/WhiteListDomain")

async function isEmployerEmailAllowed(email) {
    const restrictedDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];
    const domain = email.split("@")[1];

    // ❌ Block generic emails
    if (restrictedDomains.includes(domain)) {
        return { allowed: false, message: "Use a company email, not a personal email (e.g., Gmail, Yahoo)." };
    }

    // ✅ Check if domain is whitelisted
    const isWhitelisted = await Whitelist.findOne({ domain, approved: true });
    if (!isWhitelisted) {
        return { allowed: false, message: "Your company domain is not whitelisted. Contact admin." };
    }

    return { allowed: true };
}

module.exports = isEmployerEmailAllowed;
