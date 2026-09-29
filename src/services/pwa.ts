export const pwaUpdateReadyEvent = "wf-map:pwa-update-ready";
let reloadScheduled = false;

function reloadWhenControllerChanges() {
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloadScheduled) {
      return;
    }

    reloadScheduled = true;
    window.location.reload();
  });
}

function announceUpdate(registration: ServiceWorkerRegistration) {
  if (!registration.waiting || !navigator.serviceWorker.controller) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ServiceWorkerRegistration>(pwaUpdateReadyEvent, {
      detail: registration,
    }),
  );
}

function watchInstallingWorker(registration: ServiceWorkerRegistration) {
  const worker = registration.installing;
  if (!worker) {
    return;
  }

  if (worker.state === "installed") {
    announceUpdate(registration);

    return;
  }

  worker.addEventListener("statechange", () => {
    if (worker.state === "installed") {
      announceUpdate(registration);
    }
  });
}

export async function registerPwa() {
  if (import.meta.env.VITE_WF_PAGES !== "1" || !("serviceWorker" in navigator)) {
    return;
  }

  reloadWhenControllerChanges();

  try {
    const registration = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL },
    );

    registration.addEventListener("updatefound", () => {
      watchInstallingWorker(registration);
    });
    watchInstallingWorker(registration);
    announceUpdate(registration);
    await registration.update();
  } catch {
    // 更新检查失败时继续使用当前已缓存版本。
  }
}

export function activatePwaUpdate(registration: ServiceWorkerRegistration) {
  const worker = registration.waiting;
  if (!worker) {
    return false;
  }

  worker.postMessage("SKIP_WAITING", []);

  return true;
}
