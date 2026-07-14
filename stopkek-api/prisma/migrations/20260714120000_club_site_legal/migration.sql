-- Юридические реквизиты для сайта stopkek.site (редактируются в админке)
ALTER TABLE "Club" ADD COLUMN "operatorName" TEXT;
ALTER TABLE "Club" ADD COLUMN "inn" TEXT;
ALTER TABLE "Club" ADD COLUMN "ogrnip" TEXT;
ALTER TABLE "Club" ADD COLUMN "legalAddress" TEXT;

UPDATE "Club" SET
  "operatorName" = 'ИП Левков Павел Олегович',
  "inn" = '774395265597',
  "ogrnip" = '321774600480472',
  "legalAddress" = '125183, г. Москва, ул. Большая Академическая, д. 73/3, кв. 231',
  "supportPhone" = COALESCE("supportPhone", '+7 (915) 219-97-99')
WHERE "operatorName" IS NULL;
