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

  endGood: "Nandri, vanakkam!",

  endWrongNumber:
    "Sorry, wrong number. Thavar aa irukkum. Vanakkam!",

  endNotGoodTime:
    "Sari, vera nerathula call pannuren. Vanakkam!",

  endOptOut:
    "Sari, puriyuthu. Inimel ungalukku call pannadhu niruthuren. Venumna, apram call pannunga. Vanakkam!",

  endNoConfirm:
    "Sari, puriyala. WhatsApp la details anuppuren. Vanakkam!",
};
