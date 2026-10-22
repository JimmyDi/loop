import { RemoteAccessSettings } from "./RemoteAccessSettings";
import { RemoteDevicesSettings } from "./RemoteDevicesSettings";
import "./RemoteAccessPanel.css";

export const RemoteAccessPanel = () => (
  <div className="remote-access-panel">
    <RemoteAccessSettings>
      {(connected) => <RemoteDevicesSettings connected={connected} />}
    </RemoteAccessSettings>
  </div>
);
