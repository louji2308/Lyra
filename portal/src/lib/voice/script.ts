export const SCRIPT = {
  // ========== GREETING & TIME CHECK ==========
  greet: (shopName: string) =>
    `Vanakkam! ${shopName} aa? Shree Agencies la irundhu call pannuren.`,

  goodTime: "Ippo pesa convenient aa? Stock order confirm pannalama?",

  // ========== REPEAT ORDER ==========
  repeatOrder: (summary: string) =>
    `Last time ${summary} order pannirukeenga. Same order venuma?`,

  whatDoYouNeed: "Sari, innaikku enna venum sollunga.",

  // ========== CHANGES / CART ==========
  changes: "Sari, enna maathanum sollunga. Add panala, remove panala, sollunga. Mudichu na 'seri' nu sollunga.",

  addingToCart: (productQuery: string, qty: number) =>
    `${qty} x ${productQuery} cart la add pannuren. Vera enna venum?`,

  removingFromCart: (productQuery: string, qty: number) =>
    `${qty} x ${productQuery} cart la irunthu remove pannuren. Vera enna venum?`,

  cartEmpty: "Cart la onnum illai. Enna venum sollunga.",

  readBack: (summary: string) =>
    summary ? `Confirming: ${summary}. Correct aa?` : "Order la onnum illai. Enna venum?",

  confirm: "Order confirm pannuren. WhatsApp la summary anuppuren.",

  // ========== INFO QUERIES (stock, credit, delivery, etc.) ==========
  infoResponse: "Sari, idhoda details WhatsApp la anuppuren. Vera enna venum?",

  // ========== CATALOG QUERIES ==========
  catalogThinking: "Sari, catalog la paarkuren...",

  catalogResults: (products: Array<{ product_name: string; brand: string; category: string; price: number; unit_type: string; available_qty?: number }>) => {
    if (!products || products.length === 0) return "Catalog la onnum irukkala. Vera search pannunga.";
    const lines = products.slice(0, 8).map((p) =>
      `${p.product_name} (${p.brand}) — ₹${p.price.toFixed(0)}/${p.unit_type}${p.available_qty !== undefined ? ` [Stock: ${p.available_qty}]` : ""}`
    );
    return `Shree Agencies la ${products.length} products irukku:\n${lines.join("\n")}\nEnna venum sollunga.`;
  },

  catalogNone: "Search panna product catalog la illai. Vera enna venum?",

  catalogFound: (name: string, brand: string, price: number, unit: string, inCart: boolean) => {
    if (inCart) return `${name} ungaloda cart la irukku. Vera enna venum?`;
    return `${name} (${brand}) available irukku. ₹${price}/${unit}. Cart la add pannalama?`;
  },

  productNotFound: (query: string) =>
    `Sorry, "${query}" ippo available la illai. Vera enna venum?`,

  productNotInCart: (query: string) =>
    `"${query}" cart la illai. Vera enna venum?`,

  whatElse: "Vera enna venum?",

  // ========== UPSELL REPEAT ORDER ==========
  upsellRepeat: (repeatItems: Array<{ product_name: string; quantity: number; unit: string }>) => {
    const items = repeatItems.map((r) => `${r.quantity} ${r.unit} ${r.product_name}`).join(", ");
    return `Anna, ungaloda repeated orders la konjam product iruku: ${items}. Idha adika venuma?`;
  },

  endGoodWithUpsell: (summary: string) =>
    `Nandri! ${summary} — order confirm aachu. WhatsApp la summary anuppuren. Vanakkam!`,

  // ========== COMPLAINT ==========
  complaintAsk: "Enna problem irukku sollunga. Damaged goods? Wrong item? Late delivery?",

  complaintConfirm: (complaintType: string) =>
    `${complaintType} complaint register pannuren. Callback venuma?`,

  complaintEscalate:
    "Sari, idhu mukkiyama irukku. Naan onnoda manager kitta solren. 24 hrs la callback pannuvaanga. Vanakkam!",

  // ========== RETURN ==========
  returnAsk: "Enna product return venum? Name sollunga.",

  returnQty: (productName: string) =>
    `${productName} — ethu quantity return?`,

  returnConfirm: (productName: string, qty: number) =>
    `${productName} x ${qty} return register pannuren. Credit note kidaikum. Vanakkam!`,

  returnAskReason: (productName: string, qty: number) =>
    `Yena reason ${productName} x ${qty} return pannuringa? Damaged aa? Wrong item aa?`,

  // ========== ENDINGS ==========
  endGood: "Nandri, vanakkam!",

  endWrongNumber:
    "Sorry, wrong number. Thavar aa irukkum. Vanakkam!",

  endNotGoodTime:
    "Sari, vera nerathula call pannuren. Vanakkam!",

  endOptOut:
    "Sari, puriyuthu. Inimel ungalukku call pannadhu niruthuren. Venumna, apram call pannunga. Vanakkam!",

  endNoConfirm:
    "Sari, puriyala. WhatsApp la details anuppuren. Vanakkam!",

  notGoodTimeWithComplaint:
    "Sari, vera nerathula call pannuren. Complaint details kuraiyila solunga.",

  blacklistedProduct: (productName: string, reason: string | null) =>
    `Sorry, ${productName} indha shop ku order panna mudiyathu${reason ? ` — ${reason}` : ""}. Vera enna venum?`,

  // ========== ONBOARDING (NEW SHOP) ==========
  onboardingGreeting:
    "Vanakkam! Shree Agencies la irundhu. Intha number ku register aana shop irukkala. New shop aa register pannalama?",

  onboardingAskName: "Sari, shop peru enna?",

  onboardingAskNameRetry: (name: string) =>
    `Sari, ${name} correct aa? Area/location enna?`,

  onboardingAskArea: (name: string) =>
    name ? `${name} — sari. Area/location enna?` : "Shop peru enna?",

  onboardingAskOwner: (area: string) =>
    `${area} — sari. Owner peru enna?`,

  onboardingAskLanguage: (owner: string) =>
    `${owner} — sari. Language preference enna? (Tanglish / Tamil / Hindi / English)`,

  onboardingConfirm: (shopName: string, language: string) =>
    `Confirm: ${shopName}, Language: ${language}. Sari aagidhaa?`,

  onboardingDone:
    "Sari! Shop register aachu. Ippo stock order edhava venuma? Vanakkam!",

  // ========== CALLBACK / SCHEDULED CALLS ==========
  callbackAsk: "Eppo call pannalama? Time sollunga.",

  callbackConfirm: (time: string) =>
    `${time} ku call pannuren. Permanent-a indha time venuma, inaiku mattum?`,

  callbackConfirmTemp: (time: string) =>
    `Sari, ${time} ku inaiku call pannuren. Vanakkam!`,

  callbackConfirmPermanent: (time: string) =>
    `Sari, permanently ${time} ku call pannuven. Vanakkam!`,

  callbackTimeInvalid:
    "Time puriyala. 5 o'clock, 6 o'clock madhiri sollunga.",

  // ========== AUTO-CALL GREETING (beat day, shop called by scheduler) ==========
  autoCallGreeting: (shopName: string) =>
    `Vanakkam! ${shopName} order ready aa?`,
};