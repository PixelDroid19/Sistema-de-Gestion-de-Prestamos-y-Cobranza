const fs = require('fs');
const path = require('path');

const jsxPath = path.join(__dirname, 'src', 'pages', 'Home', 'Home.jsx');
let content = fs.readFileSync(jsxPath, 'utf8');

content = content.replace(/const globalStyles = \[\s\S]*?\;\n/g, '');

if (!content.includes("import './Home.scss';")) {
  content = content.replace(
    "import { useLoginMutation } from '@/hooks/useAuth';",
    "import { useLoginMutation } from '@/hooks/useAuth';\nimport { useTranslation } from 'react-i18next';\nimport './Home.scss';"
  );
}

content = content.replace(/\s*useEffect\(\(\) => \{\s*const styleSheet = document\.createElement\('style'\)[\s\S]*?\}, \[\]\);\n/g, '');

if (!content.includes("const { t } = useTranslation();")) {
  content = content.replace(
    "const [email, setEmail] = useState('');",
    "const { t } = useTranslation();\n  const [email, setEmail] = useState('');"
  );
}

function rep(oldStr, newStr) {
  content = content.split(oldStr).join(newStr);
}

rep('>Inicio<', '>{t("home.nav.home")}<');
rep('>Plataforma<', '>{t("home.nav.platform")}<');
rep('>Socios<', '>{t("home.nav.partners")}<');
rep('>Ingresar<', '>{t("home.auth.loginCta")}<');
rep('>Registro<', '>{t("home.auth.registerCta")}<');
rep('>Bienvenido de nuevo<', '>{t("home.auth.welcomeTitle")}<');
rep('>Ingresa a tu cuenta para gestionar créditos<', '>{t("home.auth.welcomeSubtitle")}<');
rep('label>Correo Electrónico<', 'label>{t("home.auth.emailLabel")}<');
rep('placeholder="Correo electrónico"', 'placeholder={t("home.auth.emailLabel")}');
rep('label>Contraseña<', 'label>{t("home.auth.passwordLabel")}<');
rep('placeholder="Tu contraseña"', 'placeholder={t("home.auth.passwordLabel")}');
rep('>Iniciando sesión...<', '>{t("home.auth.loadingLogin")}<');
rep('>Iniciar Sesión<', '>{t("home.auth.loginButton")}<');
rep('>Volver al inicio<', '>{t("home.auth.backToHome")}<');
rep('Gestión de <br />\n              <span className="gradient-text">préstamos,</span> <br />\n              reimaginada.', '{t("home.hero.title1")} <br /> <span className="gradient-text">{t("home.hero.title2")}</span> <br /> {t("home.hero.titleHighlight")}');
rep('La plataforma integral premium para administrar originaciones, cobranzas y seguimiento de clientes con máxima precisión y elegancia.', '{t("home.hero.description")}');
rep('>Descárgalo en la<', '>{t("home.hero.downloadApple")}<');
rep('>DISPONIBLE EN<', '>{t("home.hero.availablePlay")}<');
rep('>Cifrado 256-bit<', '>{t("home.hero.badgeEncryption")}<');
rep('>Seguridad Total<', '>{t("home.hero.badgeSecurity")}<');
rep('>Rendimiento<', '>{t("home.hero.badgePerformance")}<');

// The features replace
rep('>Elige mejor <span className="gradient-text">con LendFlow</span><', '>{t("home.features.title1")} <span className="gradient-text">{t("home.features.titleHighlight")}</span><');
rep('>Las herramientas que necesitas bajo una UI perfecta. Descubre por qué las mejores agencias nos eligen.<', '>{t("home.features.description")}<');
rep('Protege tu <br /> cartera', '{t("home.features.card1")} <br /> {t("home.features.card1Break")}');
rep('Mejora tu <br /> cobranza', '{t("home.features.card2")} <br /> {t("home.features.card2Break")}');
rep('Múltiples metas <br /> a la vez', '{t("home.features.card3")} <br /> {t("home.features.card3Break")}');

// Control
rep('>Toma control <span className="gradient-text">de tus finanzas</span><', '>{t("home.control.title1")} <span className="gradient-text">{t("home.control.titleHighlight")}</span><');
rep('>Gestión al alcance de tus dedos<', '>{t("home.control.subtitle")}<');
rep('>Monitoreo fácil con vista única<', '>{t("home.control.item1")}<');
rep('>Asignación de agentes en 1 clic<', '>{t("home.control.item2")}<');
rep('>Recordatorios de cobro premium<', '>{t("home.control.item3")}<');

// Bento
rep('>Construyendo <span className="gradient-text">experiencia para ti</span><', '>{t("home.bento.title1")} <span className="gradient-text">{t("home.bento.titleHighlight")}</span><');
rep('>Nuestra probada experiencia en servicios financieros significa que tu cartera está manejada con el mejor software.<', '>{t("home.bento.panel1Text")}<');
rep('>Descubre más<', '>{t("home.bento.discoverMore")}<');
rep('>Las mentes más brillantes realizan la investigación difícil.<', '>{t("home.bento.panel2Title")}<');
rep('>Para que puedas tomar decisiones verdaderamente prudentes sobre tu dinero sin fricciones y enfocarte al 100% en expandir tu agencia.<', '>{t("home.bento.panel2Text")}<');
rep('>Préstamos Gestionados<', '>{t("home.bento.loansManaged")}<');
rep('>Agentes Activos<', '>{t("home.bento.activeAgents")}<');

// World
rep('>El mundo de <span className="gradient-text">LendFlow</span><', '>{t("home.world.title1")} <span className="gradient-text">LendFlow</span><');
rep('>Más de 1000 usuarios confían en nuestra plataforma para mantener su cartera sana y libre de estrés.<', '>{t("home.world.description")}<');
rep('>Ubicaciones<', '>{t("home.world.locations")}<');
rep('>Operaciones<', '>{t("home.world.operations")}<');
rep('>Cartera Expansiva<', '>{t("home.world.portfolio")}<');

// footer
rep('Gestionar tus finanzas es <br />\n              a un clic.', '{t("home.footer.title")} <br /> {t("home.footer.titleBreak")}');
rep('>Términos<', '>{t("home.footer.terms")}<');
rep('>Privacidad<', '>{t("home.footer.privacy")}<');

// Find actual span for rights since string match is hard
content = content.replace(/(<span>© 2026[^<]+<\/span>)/, '<span>{t("home.footer.copyright")}</span>');

// Wrapper
if (!content.includes('<div className="home-container">')) {
  content = content.replace(
    'return (\n    <div className="landing-page">',
    'return (\n    <div className="home-container">\n      <div className="landing-page">'
  );
  
  // Replace the final </div> which terminates landing-page
  content = content.replace(
    /<\/div>\n\s*\);\n\s*\}\n*$/s,
    '      </div>\n    </div>\n  );\n}'
  );
}

fs.writeFileSync(jsxPath, content, 'utf8');
console.log('JSX Updated correctly');
