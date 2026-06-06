const PROTOCOL_LOGOS: Record<string, string> = {
  accountable: "/protocol-logos/accountable.png",
  autofinance: "/protocol-logos/autofinance.png",
  balancerv3: "/protocol-logos/balancer-v3.svg",
  beefy: "/protocol-logos/beefy.svg",
  centrifugeprotocol: "/protocol-logos/centrifuge-protocol.svg",
  curvedex: "/protocol-logos/curve-dex.svg",
  eulerv2: "/protocol-logos/euler-v2.png",
  folksfinancexchain: "/protocol-logos/folks-finance-xchain.svg",
  joev22: "/protocol-logos/joe-v2-2.png",
  kintsu: "/protocol-logos/kintsu.png",
  kuruclob: "/protocol-logos/kuru-clob.png",
  magmastaking: "/protocol-logos/magma-staking.svg",
  mentov3: "/protocol-logos/mento-v3.png",
  mudigital: "/protocol-logos/mu-digital.svg",
  neverland: "/protocol-logos/neverland.svg",
  sherpa: "/protocol-logos/sherpa.png",
  shmonad: "/protocol-logos/shmonad.png",
  townsquare: "/protocol-logos/townsquare.svg",
  travessiacredit: "/protocol-logos/travessia-credit.png",
  yuzumoney: "/protocol-logos/yuzu-money.png",
};

function protocolKey(protocol: string) {
  return protocol.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getProtocolLogoSrc(protocol: string) {
  const key = protocolKey(protocol);
  if (PROTOCOL_LOGOS[key]) return PROTOCOL_LOGOS[key];
  if (key.includes("euler")) return PROTOCOL_LOGOS.eulerv2;
  if (key.includes("curve")) return PROTOCOL_LOGOS.curvedex;
  if (key.includes("joe")) return PROTOCOL_LOGOS.joev22;
  if (key.includes("mento")) return PROTOCOL_LOGOS.mentov3;
  if (key.includes("balancer")) return PROTOCOL_LOGOS.balancerv3;
  if (key.includes("folks")) return PROTOCOL_LOGOS.folksfinancexchain;
  if (key.includes("kuru")) return PROTOCOL_LOGOS.kuruclob;
  if (key.includes("magma")) return PROTOCOL_LOGOS.magmastaking;
  if (key.includes("travessia")) return PROTOCOL_LOGOS.travessiacredit;
  if (key.includes("yuzu")) return PROTOCOL_LOGOS.yuzumoney;
  if (key.includes("mu")) return PROTOCOL_LOGOS.mudigital;
  return null;
}
