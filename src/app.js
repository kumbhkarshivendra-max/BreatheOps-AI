function applyOnboardingProfile() {
  userProfile = {
    role: document.getElementById("setupRole").value,
    zoneId: document.getElementById("setupZone").value,
    ageGroup: document.getElementById("setupAge").value,
    language: document.getElementById("setupLang").value,
    apiKey: document.getElementById("setupApiKey").value.trim()
  };

  activeZone = ZONES.find(z => z.id === userProfile.zoneId) || ZONES[0];
  document.getElementById("onboardingModal").classList.add("hidden");

  if (mapInstance) {
    setTimeout(() => {
      mapInstance.invalidateSize();
      mapInstance.setView([activeZone.lat, activeZone.lng], 13);
    }, 100);
  }

  drawMapCircles();
  renderWorkspace();

  if (userProfile.apiKey && userProfile.language !== "English") {
    handleRunGeminiAI();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("messyInput").value = SAMPLE_MESSY;
  initMap();
  syncLiveSatelliteAir();

  document.getElementById("openDashboardBtn").addEventListener("click", applyOnboardingProfile);

  document.getElementById("changeProfileBtn").addEventListener("click", () => {
    document.getElementById("onboardingModal").classList.remove("hidden");
  });

  document.getElementById("refreshLiveBtn").addEventListener("click", syncLiveSatelliteAir);
  document.getElementById("runAiBtn").addEventListener("click", handleRunGeminiAI);
  document.getElementById("whatsappWebBtn").addEventListener("click", shareToWhatsAppWeb);

  document.getElementById("copyBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("citizenAdvisoryText").textContent);
    alert("Advisory copied to clipboard!");
  });

  document.getElementById("contrastBtn").addEventListener("click", () => {
    document.body.classList.toggle("high-contrast");
  });
});
