const { src, dest, watch, parallel, series } = require("gulp");

const scss = require("gulp-sass")(require("sass"));
const concat = require("gulp-concat");
const browserSync = require("browser-sync").create();
const uglify = require("gulp-uglify-es").default;
const autoprefixer = require("gulp-autoprefixer");
const del = require("del");
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

function browsersync() {
  browserSync.init({
    server: {
      baseDir: "app/",
    },
  });
}

function cleanDist() {
  return del("dist");
}

async function images() {
  const imageFiles = await getImageFiles('app/images');
  
  for (const filePath of imageFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const outputPath = filePath.replace('app/images', 'dist/images');
    
    // Создаем папку если не существует
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    if (ext === '.svg') {
      // SVG просто копируем
      await fs.copyFile(filePath, outputPath);
    } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      // Остальные минифицируем через Sharp
      await sharp(filePath)
        .jpeg({ quality: 75, progressive: true })
        .png({ quality: 85, compressionLevel: 6 })
        .webp({ quality: 75 })
        .toFile(outputPath);
    } else {
      // Остальные файлы копируем
      await fs.copyFile(filePath, outputPath);
    }
  }
}

async function getImageFiles(dir) {
  const files = [];
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...await getImageFiles(fullPath));
      } else if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(item.name)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Если папка не существует, просто игнорируем
    console.log(`Папка ${dir} не найдена, пропускаем...`);
  }
  
  return files;
}

function scripts() {
  return src("app/js/main.js")
    .pipe(concat("main.min.js"))
    .pipe(uglify())
    .pipe(dest("app/js"))
    .pipe(browserSync.stream());
}

function styles() {
  return src("app/scss/style.scss")
    .pipe(scss({ outputStyle: "compressed" }))
    .pipe(concat("style.min.css"))
    .pipe(
      autoprefixer({
        overrideBrowserslist: ["last 10 version"],
        grid: true,
      })
    )
    .pipe(dest("app/css"))
    .pipe(browserSync.stream());
}

function build() {
  return src(
    [
      "app/css/**/*",           // Все файлы из папки css
      "app/fonts/**/*",
      "app/js/**/*",            // Все файлы из папки js
      "app/*.html",
    ],
    { base: "app" }
  ).pipe(dest("dist"));
}

function watching() {
  watch(["app/scss/**/*.scss"], styles);
  watch(["app/js/**/*.js", "!app/js/main.min.js"], scripts);
  watch(["app/*.html"]).on("change", browserSync.reload);
}

exports.styles = styles;
exports.watching = watching;
exports.browsersync = browsersync;
exports.scripts = scripts;
exports.images = images;
exports.cleanDist = cleanDist;

exports.build = series(cleanDist, images, build);
exports.default = parallel(styles, scripts, browsersync, watching);