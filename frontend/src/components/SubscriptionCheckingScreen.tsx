import LoadingState from "./LoadingState";

export default function SubscriptionCheckingScreen() {
  return (
    <LoadingState
      variant="screen"
      message="Checking your Taxlume subscription..."
      description="Verifying your access to the application."
    />
  );
}
