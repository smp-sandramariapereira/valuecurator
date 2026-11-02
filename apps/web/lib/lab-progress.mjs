const STEPS = [
  {
    id: "connect",
    title: "Connect the wallet",
    wallet: "Phantom selects this account. This step does not create a transaction.",
  },
  {
    id: "portfolio",
    title: "Initialize portfolio",
    wallet: "Phantom asks for an authentication message, then a transaction.",
  },
  {
    id: "mandate",
    title: "Initialize mandate",
    wallet: "Phantom asks for an authentication message, then a transaction.",
  },
  {
    id: "decision",
    title: "Request the ProofGate decision",
    wallet: "Phantom asks for an authentication message. No transaction is sent.",
  },
  {
    id: "settle",
    title: "Sign the swap",
    wallet: "Phantom asks for one transaction. The first instruction is the Ed25519 program and the second is the Settlement Lab.",
  },
];

export function labProgress({ connected, setupKnown, portfolioExists, mandateExists, decision }) {
  let current = "connect";
  if (connected && !setupKnown) current = "loading";
  else if (connected && !portfolioExists) current = "portfolio";
  else if (connected && !mandateExists) current = "mandate";
  else if (connected && decision === "EXECUTED") current = "done";
  else if (connected && decision === "AUTHORIZED") current = "settle";
  else if (connected) current = "decision";

  const order = ["connect", "portfolio", "mandate", "decision", "settle", "done"];
  const currentIndex = order.indexOf(current);
  return {
    current,
    steps: STEPS.map((step) => {
      const index = order.indexOf(step.id);
      const state = current === "done" || index < currentIndex ? "done" : step.id === current ? "current" : "waiting";
      return { ...step, state };
    }),
  };
}
