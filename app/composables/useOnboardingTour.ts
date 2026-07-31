export function useOnboardingTour() {
  const requestedTour = useState<string | null>('requested-onboarding-tour', () => null)

  function requestTour(tourId: string) {
    requestedTour.value = tourId
  }

  return {
    requestedTour,
    requestTour,
  }
}
