import { Component, type ReactNode } from "react";

interface Props {
  onError: () => void;
  children: ReactNode;
}

/** Bắt lỗi lúc nạp hoặc dựng avatar (vd. chunk lazy tải hỏng) để cuộc gọi không sập theo. */
export class AvatarErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Avatar lỗi:", error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
