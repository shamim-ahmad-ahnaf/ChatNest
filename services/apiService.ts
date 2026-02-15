
export class ApiService {
  private socket: WebSocket | null = null;
  private clientId: string = Math.random().toString(36).substring(7);

  connect(onMessage: (data: any) => void, onStatusChange: (status: boolean) => void) {
    try {
      // Assuming backend runs on localhost:8000
      this.socket = new WebSocket(`ws://localhost:8000/ws/${this.clientId}`);

      this.socket.onopen = () => {
        console.log("Connected to Python Backend");
        onStatusChange(true);
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessage(data);
      };

      this.socket.onclose = () => {
        console.log("Disconnected from Python Backend");
        onStatusChange(false);
        // Retry connection after 5s
        setTimeout(() => this.connect(onMessage, onStatusChange), 5000);
      };

      this.socket.onerror = () => {
        onStatusChange(false);
      };
    } catch (e) {
      onStatusChange(false);
    }
  }

  sendMessage(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }
}

export const apiService = new ApiService();
