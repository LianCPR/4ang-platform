export function SkeletonRows({ count = 5, withArt = true }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div className="admin-skel-row" key={i}>
          {withArt && <div className="admin-skel admin-skel-art" />}
          <div className="admin-skel-lines">
            <div className="admin-skel admin-skel-line" style={{ width: "40%" }} />
            <div className="admin-skel admin-skel-line" style={{ width: "22%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ height = 120 }) {
  return <div className="admin-skel" style={{ height, width: "100%" }} />;
}
