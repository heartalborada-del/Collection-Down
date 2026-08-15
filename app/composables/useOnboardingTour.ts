export function useOnboardingTour() {
  const requestedTour = useState<string | null>('requested-onboarding-tour', () => null)
  const activeTour = useState<string | null>('active-onboarding-tour', () => null)

  function requestTour(tourId: string) {
    requestedTour.value = tourId
  }

  return {
    requestedTour,
    activeTour,
    requestTour,
  }
}
