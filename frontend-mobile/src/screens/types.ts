// Shared navigation contract used by all screens (port del objeto `nav` de app.jsx).
export interface Nav {
  go: (toTab: string, pushRoute?: string) => void;
  push: (route: string, data?: any) => void;
  back: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toast: (msg: string, icon?: string, tone?: string) => void;
}
