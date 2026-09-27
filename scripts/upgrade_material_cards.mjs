import fs from "node:fs";

const path = "/home/ubuntu/modernite-bipv-platform/client/src/App.tsx";
let code = fs.readFileSync(path, "utf8");

const oldSnippet = `{products.length > 0 ? <div className="product-pills">{products.map((choice) => <button key={choice.id} className={choice.id === surface.productId ? "selected" : ""} onClick={() => applyProduct(surface, choice.id)}><strong>{choice.name}</strong><small>{numberFor(language, outputFor(choice), 1)} Wp/m²</small></button>)}</div> : <p className="filter-empty">No compatible products match this material type. Change the library filter or select another surface category.</p>}{product?.category === "roof" && <div className="finish-row"><span>Applied finish</span>{TILE_COLOURS.map((colour) => <button key={colour.id} aria-label={colour.name} title={colour.name} className={surface.finishId === colour.id ? "swatch selected" : "swatch"} style={{ backgroundColor: colour.hex }} onClick={() => state.updateSurface(surface.id, { finishId: colour.id })} />)}{surface.finishId !== "black" && <p className="colour-notice">{t(language, "products.colour_notice")} {product.colouredWpPerM2} Wp/m².</p>}</div>}`;

const newSnippet = `{products.length > 0 ? (
  <div className="interactive-material-grid">
    {products.map((choice) => (
      <InteractiveMaterialCard
        key={choice.id}
        product={choice}
        isSelected={choice.id === surface.productId}
        appliedFinish={surface.finishId}
        onSelect={() => applyProduct(surface, choice.id)}
        onFinishChange={(finishId) => state.updateSurface(surface.id, { finishId })}
        availableFinishes={TILE_COLOURS}
      />
    ))}
  </div>
) : (
  <p className="filter-empty">No compatible products match this material type. Change the library filter or select another surface category.</p>
)}`;

if (code.includes(oldSnippet)) {
  code = code.replace(oldSnippet, newSnippet);
  fs.writeFileSync(path, code, "utf8");
  console.log("Successfully replaced product-pills with interactive-material-grid");
} else {
  console.error("Snippet not found");
  process.exit(1);
}
