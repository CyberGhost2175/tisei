import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — TiSei",
  description:
    "Политика конфиденциальности и обработки персональных данных сервиса TiSei.",
};

const UPDATED = "6 июля 2026 г.";

export default function PrivacyPage() {
  return (
    <div className="bg-surface min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary h-20 flex items-center border-b border-outline-variant/20">
        <div className="flex justify-between items-center w-full px-5 md:px-lg lg:px-xl max-w-[1000px] mx-auto">
          <Link href="/" className="flex items-center gap-base">
            <img alt="TiSei" className="h-10 w-auto" src="/tisei-logo.png" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-xs text-on-primary hover:text-secondary-fixed-dim transition-colors font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            На главную
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1000px] mx-auto px-5 md:px-lg lg:px-xl py-14 md:py-xl">
        <h1 className="text-primary font-headline-lg text-headline-lg mb-xs">
          Политика конфиденциальности
        </h1>
        <p className="text-on-surface-variant font-body-md mb-xl">
          Дата последнего обновления: {UPDATED}
        </p>

        <div className="space-y-lg text-on-surface-variant font-body-md leading-relaxed">
          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              1. Общие положения
            </h2>
            <p>
              Настоящая Политика конфиденциальности (далее — «Политика») определяет
              порядок обработки и защиты персональных данных пользователей сайта
              TiSei (далее — «Сайт»), оператором которого является ИП «TiSei
              Service» (далее — «Компания», «мы»). Используя Сайт и оставляя заявку,
              вы подтверждаете согласие с условиями настоящей Политики.
            </p>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              2. Какие данные мы собираем
            </h2>
            <p>При оформлении заявки и обращении в Компанию мы можем обрабатывать:</p>
            <ul className="list-disc pl-6 space-y-xs">
              <li>имя и название компании;</li>
              <li>контактный телефон и адрес электронной почты;</li>
              <li>адрес объекта, где расположено оборудование;</li>
              <li>сведения об оборудовании и описание неисправности;</li>
              <li>прикреплённые вами фотографии и файлы;</li>
              <li>
                технические данные: IP-адрес, тип браузера и устройства, данные
                файлов cookie.
              </li>
            </ul>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              3. Цели обработки данных
            </h2>
            <ul className="list-disc pl-6 space-y-xs">
              <li>обработка и выполнение заявок на ремонт и обслуживание;</li>
              <li>связь с вами для уточнения деталей и согласования выезда;</li>
              <li>оказание услуг и исполнение договорных обязательств;</li>
              <li>улучшение качества обслуживания и работы Сайта;</li>
              <li>
                направление сервисной информации и уведомлений по вашему запросу.
              </li>
            </ul>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              4. Правовые основания
            </h2>
            <p>
              Обработка персональных данных осуществляется на основании вашего
              согласия, а также в целях исполнения договора и в соответствии с
              законодательством Республики Казахстан «О персональных данных и их
              защите».
            </p>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              5. Файлы cookie
            </h2>
            <p>
              Сайт использует файлы cookie и сервисы веб-аналитики для корректной
              работы, анализа посещаемости и улучшения удобства использования. Вы
              можете отключить cookie в настройках браузера, однако это может
              повлиять на работу отдельных функций Сайта.
            </p>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              6. Передача данных третьим лицам
            </h2>
            <p>
              Мы не продаём и не передаём ваши персональные данные третьим лицам,
              за исключением случаев, необходимых для оказания услуг (например,
              выезда мастера), а также случаев, предусмотренных законодательством.
              Привлекаемые подрядчики обязаны обеспечивать конфиденциальность
              данных.
            </p>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              7. Сроки хранения
            </h2>
            <p>
              Персональные данные хранятся в течение срока, необходимого для
              достижения целей обработки, либо до отзыва вами согласия, если иное
              не предусмотрено законодательством.
            </p>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              8. Ваши права
            </h2>
            <p>Вы имеете право:</p>
            <ul className="list-disc pl-6 space-y-xs">
              <li>получать информацию об обработке ваших данных;</li>
              <li>требовать уточнения, блокирования или удаления данных;</li>
              <li>отозвать согласие на обработку персональных данных;</li>
              <li>обжаловать действия Компании в уполномоченный орган.</li>
            </ul>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              9. Защита данных
            </h2>
            <p>
              Компания принимает необходимые организационные и технические меры для
              защиты персональных данных от неправомерного доступа, изменения,
              раскрытия или уничтожения.
            </p>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              10. Изменения политики
            </h2>
            <p>
              Компания вправе вносить изменения в настоящую Политику. Актуальная
              редакция всегда доступна на данной странице с указанием даты
              обновления.
            </p>
          </section>

          <section className="space-y-sm">
            <h2 className="text-primary font-headline-md text-headline-md">
              11. Контакты
            </h2>
            <p>По вопросам обработки персональных данных обращайтесь:</p>
            <ul className="space-y-xs">
              <li>Компания: ИП «TiSei Service»</li>
              <li>
                Телефон:{" "}
                <a
                  className="text-secondary hover:underline underline-offset-4"
                  href="tel:+77785580747"
                >
                  +7 778 558 0747
                </a>
              </li>
              <li>
                Email:{" "}
                <a
                  className="text-secondary hover:underline underline-offset-4"
                  href="mailto:tiseiservice@gmail.com"
                >
                  tiseiservice@gmail.com
                </a>
              </li>
              <li>Адрес: Казахстан, г. Астана, ул. Жанкент 180/1</li>
            </ul>
          </section>
        </div>

        <div className="mt-xl pt-lg border-t border-outline-variant/50">
          <Link
            href="/"
            className="inline-flex items-center gap-xs bg-secondary-container text-on-primary px-lg py-md rounded-[4px] font-label-md text-label-md hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Вернуться на главную
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-primary text-on-primary/60 border-t border-outline-variant/20 py-lg">
        <div className="max-w-[1000px] mx-auto px-5 md:px-lg lg:px-xl">
          <p className="font-mono-data text-xs">
            © 2024 TiSei. Все права защищены. Казахстан.
          </p>
        </div>
      </footer>
    </div>
  );
}
