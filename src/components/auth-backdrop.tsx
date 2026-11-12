"use client";

export function AuthBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      <div className="auth-backdrop-glow auth-backdrop-glow-one" />
      <div className="auth-backdrop-glow auth-backdrop-glow-two" />
      <svg className="auth-backdrop-routes" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <path className="auth-route-line auth-route-line-one" d="M-120 650 C 160 420, 270 830, 520 600 S 850 250, 1110 430 S 1370 590, 1570 300" />
        <path className="auth-route-line auth-route-line-two" d="M-100 260 C 180 420, 350 100, 590 300 S 920 700, 1160 560 S 1390 350, 1540 620" />
        <path className="auth-route-line auth-route-line-three" d="M120 980 C 310 720, 500 760, 700 850 S 1060 950, 1320 740" />
        <circle className="auth-route-node auth-route-node-one" cx="520" cy="600" r="5" />
        <circle className="auth-route-node auth-route-node-two" cx="1110" cy="430" r="5" />
        <circle className="auth-route-node auth-route-node-three" cx="590" cy="300" r="4" />
      </svg>
      <span className="auth-backdrop-orb auth-backdrop-orb-one" />
      <span className="auth-backdrop-orb auth-backdrop-orb-two" />
      <span className="auth-backdrop-orb auth-backdrop-orb-three" />
    </div>
  );
}
