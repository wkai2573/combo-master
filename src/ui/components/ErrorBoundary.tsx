import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null }

/** 最外層的錯誤保護：畫面元件拋出錯誤時，顯示說明與復原按鈕，不讓整片畫面變黑 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('畫面發生錯誤', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page narrow home">
        <div className="panel errorpanel" role="alert">
          <h2 style={{ color: 'var(--bad)' }}>畫面發生錯誤</h2>
          <p className="muted">這一局的畫面無法繼續顯示。重新載入或回到首頁後可以再開一局。</p>
          <p className="errormsg">{this.state.error.message}</p>
          <div className="btns">
            <button className="primary" onClick={() => window.location.reload()}>重新載入</button>
            <button onClick={() => this.setState({ error: null })}>回首頁</button>
          </div>
        </div>
      </div>
    );
  }
}
