export function AnimatedBackground() {
  return (
    <div className="cosmos-bg">
      {/* Nebulae — большие светящиеся туманности */}
      <div className="cosmos-bg__nebula cosmos-bg__nebula--violet" />
      <div className="cosmos-bg__nebula cosmos-bg__nebula--cyan" />
      <div className="cosmos-bg__nebula cosmos-bg__nebula--magenta" />
      <div className="cosmos-bg__nebula cosmos-bg__nebula--blue" />

      {/* Звёздные поля — 3 параллакс-слоя */}
      <div className="cosmos-bg__stars cosmos-bg__stars--far" />
      <div className="cosmos-bg__stars cosmos-bg__stars--mid" />
      <div className="cosmos-bg__stars cosmos-bg__stars--near" />

      {/* Падающие звёзды */}
      <div className="cosmos-bg__shooting" />
      <div className="cosmos-bg__shooting cosmos-bg__shooting--alt" />
      <div className="cosmos-bg__shooting cosmos-bg__shooting--third" />

      {/* Слабая космическая сетка */}
      <div className="cosmos-bg__grid" />
    </div>
  );
}
