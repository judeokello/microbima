import { SelfServiceHomeClient } from './_components/self-service-home-client';

/**
 * Generic member login (US1). Redirects existing customer sessions to home or PIN setup.
 */
export default function CustomerSelfServiceHomePage() {
  return <SelfServiceHomeClient />;
}
