# Oracle security

An observation is admissible only when the price is positive, confidence is present, the publish time is not in the future, the age is inside the mandate, the asset matches, the provider was requested, and the license is `authorized`.

Absent confidence stays null. It is not stored as zero.

Simulated evidence and the disabled Chainlink adapter cannot create `READY_FOR_APPROVAL`.

HTTPS and the payload digest show where the parsed price came from. They are not an independent cryptographic attestation of the publisher.

Provider credentials stay in server environment variables. The catalog route returns labels only.
