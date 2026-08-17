export const SCRIPT = {
  greet: (shopName: string) =>
    `Vanakkam! ${shopName} aa? Shree Agencies la irundhu call pannuren.`,

  goodTime: "Ippo pesa convenient aa? Stock order confirm pannalama?",

  repeatOrder: (summary: string) =>
    `Last time ${summary} order pannirukeenga. Same order venuma?`,

  whatDoYouNeed: "Sari, innaikku enna venum sollunga.",

  changes: "Sari, enna maathanum sollunga. Add panala, remove panala, sollunga.",

  readBack: (summary: string) => `Confirming: ${summary}. Correct aa?`,

  confirm: "Order confirm. WhatsApp la summary anuppuren.",

  complaintAsk: "Enna problem irukku sollunga. Damaged goods? Wrong item? Late delivery?",

  complaintConfirm: (complaintType: string) =>
    `${complaintType} complaint register pannuren. Callback venuma?`,

  complaintEscalate:
    "Sari, idhu mukkiyama irukku. Naan onnoda manager kitta solren. 24 hrs la callback pannuvaanga. Vanakkam!",

  returnAsk: "Enna product return venum? Name sollunga.",

  returnQty: (productName: string) =>
    `${productName} — ethu quantity return?`,

  returnConfirm: (productName: string, qty: number) =>
    `${productName} x ${qty} return register pannuren. Credit note kidaikum. Vanakkam!`,

  returnAskReason: (productName: string, qty: number) =>
    `Yena reason ${productName} x ${qty} return pannuringa? Damaged aa? Wrong item aa?`,

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
};
