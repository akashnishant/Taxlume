import LoadingState from "./LoadingState";

export default function SubscriptionCheckingScreen() {
  return (
    <LoadingState
      variant="screen"
      message="Checking your Techabanca Billing subscription..."
      description="Verifying your access to the application."
    />
  );
}
