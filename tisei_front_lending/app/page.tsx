import Link from "next/link";
import { RequestForm } from "@/components/RequestForm";
import { ScrollAnimations } from "@/components/ScrollAnimations";
import { MobileMenu } from "@/components/MobileMenu";

const filled = { fontVariationSettings: "'FILL' 1" } as const;

export default function Home() {
  return (
    <>
      <ScrollAnimations />

      {/* TopNavBar */}
      <header className="fixed top-0 w-full z-50 bg-primary shadow-sm h-20 flex items-center border-b border-outline-variant/20">
        <div className="flex justify-between items-center w-full px-5 md:px-lg lg:px-xl max-w-[1280px] mx-auto h-20">
          <div className="flex items-center gap-base">
            <img alt="TiSei" className="h-10 w-auto" src="/tisei-logo.png" />
          </div>
          <nav className="hidden md:flex items-center gap-md">
            <a className="text-on-primary hover:text-secondary-fixed-dim transition-colors font-label-md text-label-md" href="#services">Услуги</a>
            <a className="text-on-primary hover:text-secondary-fixed-dim transition-colors font-label-md text-label-md" href="#workflow">Как мы работаем</a>
            <a className="text-on-primary hover:text-secondary-fixed-dim transition-colors font-label-md text-label-md" href="#reviews">Отзывы</a>
            <a className="text-on-primary hover:text-secondary-fixed-dim transition-colors font-label-md text-label-md" href="#contacts">Контакты</a>
          </nav>
          <div className="flex items-center gap-base">
            <a className="hidden md:inline-flex bg-secondary-container text-on-primary px-md py-sm rounded-[2px] transition-all hover:opacity-90 font-label-md text-label-md" href="#request">Оставить заявку</a>
            <MobileMenu />
          </div>
        </div>
      </header>

      {/* Section 1: Hero */}
      <section className="relative lg:min-h-screen pt-28 pb-14 lg:pt-20 lg:pb-0 flex items-center bg-primary overflow-hidden industrial-grid">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-transparent z-10"></div>
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl w-full grid grid-cols-1 lg:grid-cols-2 gap-lg items-center relative z-20">
          <div className="space-y-md">
            <div className="inline-flex items-center gap-xs bg-primary-container px-sm py-xs border border-secondary-fixed-dim/30 rounded-[12px]">
              <span className="w-2 h-2 rounded-[12px] bg-secondary-container animate-pulse"></span>
              <span className="text-secondary-fixed-dim font-label-md text-label-md">Ответ в течение 2 часов </span>
            </div>
            <h1 className="text-on-primary font-display-lg text-display-lg leading-tight">
              Сломалось оборудование? <br /><span className="text-secondary-fixed-dim">Починим быстро.</span>
            </h1>
            <p className="text-on-primary/70 font-body-lg text-body-lg max-w-[36rem]">
              Профессиональный ремонт и обслуживание торгового и промышленного холодильного оборудования в Астане.
            </p>
            <div className="flex flex-wrap gap-md pt-base">
              <a className="bg-secondary-container text-on-primary px-lg py-md rounded-[4px] font-label-md text-label-md hover:scale-[1.02] transition-transform" href="#request">Оставить заявку</a>
              <a className="border border-outline-variant text-on-primary px-lg py-md rounded-[4px] font-label-md text-label-md hover:bg-on-primary/10 transition-colors" href="tel:++77785580747">Позвонить нам</a>
            </div>
          </div>
          <div className="hidden lg:block relative h-[600px]">
            <div className="absolute inset-0 bg-secondary-container/10 blur-3xl rounded-[12px]"></div>
            <img alt="Ремонт оборудования" className="relative z-10 w-full h-full object-cover rounded-[8px] shadow-2xl border border-outline-variant/30" src="/landing/hero.png" />
          </div>
        </div>
      </section>

      {/* Section 2: Trust Bar */}
      <section className="bg-primary-container py-lg border-y border-outline-variant/10">
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-lg text-center">
            <div className="space-y-xs">
              <div className="text-secondary-fixed-dim font-display-lg text-display-lg">1200+</div>
              <div className="text-on-primary/60 font-label-md text-label-md">завершенных ремонтов</div>
            </div>
            <div className="space-y-xs">
              <div className="text-secondary-fixed-dim font-display-lg text-display-lg">5 лет</div>
              <div className="text-on-primary/60 font-label-md text-label-md">на рынке</div>
            </div>
            <div className="space-y-xs">
              <div className="text-secondary-fixed-dim font-display-lg text-display-lg">98%</div>
              <div className="text-on-primary/60 font-label-md text-label-md">довольных клиентов</div>
            </div>
           
          </div>
        </div>
      </section>

      {/* Section 3: Services */}
      <section className="py-14 md:py-xl bg-surface" id="services">
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl">
          <div className="mb-lg">
            <h2 className="text-primary font-headline-lg text-headline-lg">Что мы ремонтируем</h2>
            <div className="w-20 h-1 bg-secondary-container mt-base"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            <div className="bg-surface-container-lowest p-md border border-outline-variant/30 hover:border-l-secondary-container border-l-4 transition-all group">
              <span className="material-symbols-outlined text-secondary-container text-4xl mb-base">kitchen</span>
              <h3 className="font-headline-md text-headline-md text-primary mb-xs">Кухонные холодильники</h3>
              <p className="text-on-surface-variant font-body-md">Витрины, шкафы и лари для розничных сетей и магазинов.</p>
            </div>
            <div className="bg-surface-container-lowest p-md border border-outline-variant/30 hover:border-l-secondary-container border-l-4 transition-all group">
              <span className="material-symbols-outlined text-secondary-container text-4xl mb-base">ac_unit</span>
              <h3 className="font-headline-md text-headline-md text-primary mb-xs">Морозильные камеры</h3>
              <p className="text-on-surface-variant font-body-md">Низкотемпературные системы для долгосрочного хранения.</p>
            </div>
            <div className="bg-surface-container-lowest p-md border border-outline-variant/30 hover:border-l-secondary-container border-l-4 transition-all group">
              <span className="material-symbols-outlined text-secondary-container text-4xl mb-base">hvac</span>
              <h3 className="font-headline-md text-headline-md text-primary mb-xs">Кондиционеры / HVAC</h3>
              <p className="text-on-surface-variant font-body-md">Центральное кондиционирование и сплит-системы любой сложности.</p>
            </div>
            <div className="bg-surface-container-lowest p-md border border-outline-variant/30 hover:border-l-secondary-container border-l-4 transition-all group">
              <span className="material-symbols-outlined text-secondary-container text-4xl mb-base">gas_meter</span>
              <h3 className="font-headline-md text-headline-md text-primary mb-xs">Индукционные плиты</h3>
              <p className="text-on-surface-variant font-body-md">Ремонт нагревательных элементов и систем управления.</p>
            </div>
            <div className="bg-surface-container-lowest p-md border border-outline-variant/30 hover:border-l-secondary-container border-l-4 transition-all group">
              <span className="material-symbols-outlined text-secondary-container text-4xl mb-base">severe_cold</span>
              <h3 className="font-headline-md text-headline-md text-primary mb-xs">Льдогенераторы</h3>
              <p className="text-on-surface-variant font-body-md">Обслуживание и ремонт профессиональных льдогенераторов.</p>
            </div>
            <div className="bg-surface-container-lowest p-md border border-outline-variant/30 hover:border-l-secondary-container border-l-4 transition-all group">
              <span className="material-symbols-outlined text-secondary-container text-4xl mb-base">restaurant</span>
              <h3 className="font-headline-md text-headline-md text-primary mb-xs">Пароконвектоматы</h3>
              <p className="text-on-surface-variant font-body-md">Ремонт и обслуживание пароконвектоматов для ресторанов и производств.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: How it works */}
      <section className="py-14 md:py-xl bg-surface-container-low overflow-hidden" id="workflow">
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl">
          <h2 className="text-primary font-headline-lg text-headline-lg text-center mb-xl">Как мы работаем</h2>
          <div className="relative">
            <div className="absolute top-8 left-0 w-full h-[2px] bg-outline-variant hidden md:block">
              <div className="h-full bg-secondary-container step-line-animate" style={{ backgroundImage: "linear-gradient(90deg, #1B6EF3 50%, transparent 50%)", width: "100%" }}></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-lg relative z-10">
              <div className="text-center group">
                <div className="w-16 h-16 bg-primary text-on-primary rounded-[12px] flex items-center justify-center mx-auto mb-md border-4 border-surface shadow-lg group-hover:scale-110 transition-transform">
                  <span className="font-headline-md">1</span>
                </div>
                <h4 className="font-headline-md text-primary mb-xs">Заявка</h4>
                <p className="text-on-surface-variant text-body-md">Оставьте заявку на сайте или позвоните нам</p>
              </div>
              <div className="text-center group">
                <div className="w-16 h-16 bg-primary text-on-primary rounded-[12px] flex items-center justify-center mx-auto mb-md border-4 border-surface shadow-lg group-hover:scale-110 transition-transform">
                  <span className="font-headline-md">2</span>
                </div>
                <h4 className="font-headline-md text-primary mb-xs">Звонок (15 мин)</h4>
                <p className="text-on-surface-variant text-body-md">Менеджер уточнит детали и назначит время</p>
              </div>
              <div className="text-center group">
                <div className="w-16 h-16 bg-primary text-on-primary rounded-[12px] flex items-center justify-center mx-auto mb-md border-4 border-surface shadow-lg group-hover:scale-110 transition-transform">
                  <span className="font-headline-md">3</span>
                </div>
                <h4 className="font-headline-md text-primary mb-xs">Приезд мастера</h4>
                <p className="text-on-surface-variant text-body-md">Диагностика на месте в течение 1-2 часов</p>
              </div>
              <div className="text-center group">
                <div className="w-16 h-16 bg-secondary-container text-on-primary rounded-[12px] flex items-center justify-center mx-auto mb-md border-4 border-surface shadow-lg group-hover:scale-110 transition-transform">
                  <span className="font-headline-md">4</span>
                </div>
                <h4 className="font-headline-md text-primary mb-xs">Ремонт и акт</h4>
                <p className="text-on-surface-variant text-body-md">Завершение работ и предоставление гарантии</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Equipment Showcase */}
      <section className="py-14 md:py-xl bg-primary">
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl">
          <h2 className="text-on-primary font-headline-lg text-headline-lg text-center mb-xl">Специализированное оборудование</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            <div className="relative h-64 overflow-hidden rounded-[8px] group">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: "url('/landing/polair-fridge.png')" }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent"></div>
              <div className="absolute bottom-md left-md">
                <p className="text-secondary-fixed-dim font-label-md mb-xs">01</p>
                <h4 className="text-on-primary font-headline-md">Торговый холод</h4>
              </div>
            </div>
            <div className="relative h-64 overflow-hidden rounded-[8px] group">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: "url('/landing/showcase-induction.png')" }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent"></div>
              <div className="absolute bottom-md left-md">
                <p className="text-secondary-fixed-dim font-label-md mb-xs">02</p>
                <h4 className="text-on-primary font-headline-md">Индукционные плиты</h4>
              </div>
            </div>
            <div className="relative h-64 overflow-hidden rounded-[8px] group">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: "url('/landing/showcase-03.png')" }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent"></div>
              <div className="absolute bottom-md left-md">
                <p className="text-secondary-fixed-dim font-label-md mb-xs">03</p>
                <h4 className="text-on-primary font-headline-md">Морозильные склады</h4>
              </div>
            </div>
            <div className="relative h-64 overflow-hidden rounded-[8px] group">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: "url('/landing/showcase-04.png')" }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent"></div>
              <div className="absolute bottom-md left-md">
                <p className="text-secondary-fixed-dim font-label-md mb-xs">04</p>
                <h4 className="text-on-primary font-headline-md">Платы от промышленного оборудования</h4>
              </div>
            </div>
            <div className="relative h-64 overflow-hidden rounded-[8px] group">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: "url('/landing/showcase-05.png')" }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent"></div>
              <div className="absolute bottom-md left-md">
                <p className="text-secondary-fixed-dim font-label-md mb-xs">05</p>
                <h4 className="text-on-primary font-headline-md">Сервис без выходных</h4>
              </div>
            </div>
            <div className="relative h-64 overflow-hidden rounded-[8px] group">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: "url('/landing/showcase-06.png')" }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent"></div>
              <div className="absolute bottom-md left-md">
                <p className="text-secondary-fixed-dim font-label-md mb-xs">06</p>
                <h4 className="text-on-primary font-headline-md">Чиллерные установки</h4>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Why TiSei */}
      <section className="py-14 md:py-xl bg-surface">
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl items-center">
            <div className="space-y-lg">
              <h2 className="text-primary font-headline-lg text-headline-lg">Почему выбирают TiSei</h2>
              <ul className="space-y-md">
                <li className="flex items-start gap-md">
                  <span className="material-symbols-outlined text-secondary-container p-xs bg-secondary-fixed rounded-[12px]" style={filled}>check</span>
                  <div>
                    <h4 className="font-headline-md text-primary">Сертифицированные инженеры</h4>
                    <p className="text-on-surface-variant">Все мастера имеют допуски к работе с профессиональным оборудованием мировых брендов.</p>
                  </div>
                </li>
                <li className="flex items-start gap-md">
                  <span className="material-symbols-outlined text-secondary-container p-xs bg-secondary-fixed rounded-[12px]" style={filled}>check</span>
                  <div>
                    <h4 className="font-headline-md text-primary">Собственный склад запчастей</h4>
                    <p className="text-on-surface-variant">Более 2000 позиций в наличии, что сокращает время ремонта на 60%.</p>
                  </div>
                </li>
                <li className="flex items-start gap-md">
                  <span className="material-symbols-outlined text-secondary-container p-xs bg-secondary-fixed rounded-[12px]" style={filled}>check</span>
                  <div>
                    <h4 className="font-headline-md text-primary">Гарантия до 12 месяцев</h4>
                    <p className="text-on-surface-variant">Предоставляем официальные гарантийные обязательства на все выполненные работы.</p>
                  </div>
                </li>
                <li className="flex items-start gap-md">
                  <span className="material-symbols-outlined text-secondary-container p-xs bg-secondary-fixed rounded-[12px]" style={filled}>check</span>
                  <div>
                    <h4 className="font-headline-md text-primary">GPS-мониторинг бригад</h4>
                    <p className="text-on-surface-variant">Мы всегда знаем, где наш мастер, и гарантируем точное время прибытия.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -top-lg -left-lg w-32 h-32 bg-secondary-fixed rounded-[12px] blur-3xl opacity-50"></div>
              <div className="relative bg-surface-container rounded-2xl p-md border border-outline-variant shadow-xl overflow-hidden">
                <img className="w-full h-auto rounded-[8px]" alt="Сервисный инженер TiSei" src="/landing/why-tisei.png" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6.5: Partnership / Service contracts */}
      <section className="py-14 md:py-xl bg-primary industrial-grid" id="cooperation">
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl">
          <div className="max-w-3xl mb-xl">
            <div className="inline-flex items-center gap-xs bg-primary-container px-sm py-xs border border-secondary-fixed-dim/30 rounded-[12px] mb-md">
              <span className="material-symbols-outlined text-secondary-fixed-dim text-base" style={filled}>handshake</span>
              <span className="text-secondary-fixed-dim font-label-md text-label-md">Для бизнеса · договор обслуживания</span>
            </div>
            <h2 className="text-on-primary font-headline-lg text-headline-lg mb-base">Обслуживание объектов по сотрудничеству</h2>
            <p className="text-on-primary/70 font-body-lg text-body-lg">
              Заключите договор на сервисное обслуживание — и мы возьмём ваше оборудование под полный контроль. Плановые проверки, приоритетный выезд и фиксированные цены для сетей, ресторанов, супермаркетов и производств.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
            <div className="bg-primary-container p-md border border-outline-variant/20 hover:border-l-secondary-container border-l-4 transition-all">
              <span className="material-symbols-outlined text-secondary-fixed-dim text-4xl mb-base">event_repeat</span>
              <h3 className="font-headline-md text-headline-md text-on-primary mb-xs">Плановое ТО по графику</h3>
              <p className="text-on-primary/60 font-body-md">Регулярное обслуживание по согласованному графику предотвращает поломки и продлевает срок службы.</p>
            </div>
            <div className="bg-primary-container p-md border border-outline-variant/20 hover:border-l-secondary-container border-l-4 transition-all">
              <span className="material-symbols-outlined text-secondary-fixed-dim text-4xl mb-base">bolt</span>
              <h3 className="font-headline-md text-headline-md text-on-primary mb-xs">Приоритетный выезд</h3>
              <p className="text-on-primary/60 font-body-md">Партнёры по договору обслуживаются вне очереди — аварийная бригада приедет 24/7.</p>
            </div>
            <div className="bg-primary-container p-md border border-outline-variant/20 hover:border-l-secondary-container border-l-4 transition-all">
              <span className="material-symbols-outlined text-secondary-fixed-dim text-4xl mb-base">payments</span>
              <h3 className="font-headline-md text-headline-md text-on-primary mb-xs">Фиксированные цены</h3>
              <p className="text-on-primary/60 font-body-md">Фиксированные цены на запчасти и бесплатный ремонт по договору — без наценок за срочность и выезды.</p>
            </div>
            <div className="bg-primary-container p-md border border-outline-variant/20 hover:border-l-secondary-container border-l-4 transition-all">
              <span className="material-symbols-outlined text-secondary-fixed-dim text-4xl mb-base">support_agent</span>
              <h3 className="font-headline-md text-headline-md text-on-primary mb-xs">Персональный менеджер</h3>
              <p className="text-on-primary/60 font-body-md">Единая точка контакта и понятная отчётность по всем вашим объектам.</p>
            </div>
          </div>
          <div className="mt-xl flex flex-wrap items-center gap-md">
            <a className="bg-secondary-container text-on-primary px-lg py-md rounded-[4px] font-label-md text-label-md hover:scale-[1.02] transition-transform" href="tel:++77785580747">Обсудить сотрудничество</a>
          </div>
        </div>
      </section>

      {/* Section 7: Reviews */}
      <section className="py-14 md:py-xl bg-surface-container-low" id="reviews">
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl">
          <h2 className="text-primary font-headline-lg text-headline-lg text-center mb-xl">Что говорят наши клиенты</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div className="bg-surface-container-lowest p-lg rounded-[2px] shadow-sm border border-outline-variant/30 flex flex-col justify-between h-full">
              <div>
                <div className="flex gap-xs text-secondary mb-md">
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                </div>
                <p className="italic text-on-surface-variant mb-lg font-body-md">&quot;TiSei выручили, когда у нас в ресторане в субботу вечером полетел ледогенератор. Мастер был через час. Починили быстро, работа не встала.&quot;</p>
              </div>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 bg-white rounded-[2px] border border-outline-variant/30 overflow-hidden flex items-center justify-center">
                  <img src="/landing/gol-pas.png" alt="Гол + Пас" className="w-full h-full object-contain p-1" />
                </div>
                <div>
                  <h5 className="font-headline-md text-primary text-base">Гол + Пас</h5>
                  <p className="text-label-md text-outline">Сеть ресторанов</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-lg rounded-[2px] shadow-sm border border-outline-variant/30 flex flex-col justify-between h-full">
              <div>
                <div className="flex gap-xs text-secondary mb-md">
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                </div>
                <p className="italic text-on-surface-variant mb-lg font-body-md">&quot;Работаем по договору сервисного обслуживания уже 2 года. Забыли, что такое простои оборудования. Профессиональный подход.&quot;</p>
              </div>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 bg-white rounded-[2px] border border-outline-variant/30 overflow-hidden flex items-center justify-center">
                  <img src="/landing/kfc.png" alt="KFC" className="w-full h-full object-contain p-1" />
                </div>
                <div>
                  <h5 className="font-headline-md text-primary text-base">KFC</h5>
                  <p className="text-label-md text-outline">Ресторан быстрого питания</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-lg rounded-[2px] shadow-sm border border-outline-variant/30 flex flex-col justify-between h-full">
              <div>
                <div className="flex gap-xs text-secondary mb-md">
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                  <span className="material-symbols-outlined" style={filled}>star</span>
                </div>
                <p className="italic text-on-surface-variant mb-lg font-body-md">&quot;Лучший сервис в Астане. Цены адекватные, мастера вежливые и компетентные. Сразу видно уровень компании.&quot;</p>
              </div>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 bg-white rounded-[2px] border border-outline-variant/30 overflow-hidden flex items-center justify-center">
                  <img src="/landing/hardees.png" alt="Hardee's" className="w-full h-full object-contain p-1" />
                </div>
                <div>
                  <h5 className="font-headline-md text-primary text-base">Hardee's</h5>
                  <p className="text-label-md text-outline">Ресторан быстрого питания</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 8: Request Form */}
      <section className="py-14 md:py-xl bg-surface relative" id="request">
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl relative z-10">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col lg:flex-row">
            {/* Left: Form */}
            <div className="flex-1 p-lg md:p-xl">
              <RequestForm />
            </div>
            {/* Right: Panel */}
            <div className="w-full lg:w-[400px] bg-primary p-lg md:p-xl text-on-primary flex flex-col justify-between">
              <div>
                <h3 className="font-headline-md mb-lg">Контакты</h3>
                <div className="space-y-lg">
                  <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-secondary-fixed-dim">phone_in_talk</span>
                    <div>
                      <p className="text-label-md text-on-primary/60">Горячая линия</p>
                      <p className="font-headline-md">+7 778 558 0747</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-secondary-fixed-dim">mail</span>
                    <div>
                      <p className="text-label-md text-on-primary/60">Email</p>
                      <p className="font-headline-md">tiseiservice@gmail.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-secondary-fixed-dim">location_on</span>
                    <div>
                      <p className="text-label-md text-on-primary/60">Адрес</p>
                      <p className="font-body-md">Казахстан, г. Астана, ул. Жанкент 180/1</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-xl relative h-48 rounded-[8px] overflow-hidden border border-outline-variant/30" id="contacts">
                <iframe
                  title="TiSei на карте"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d274.12380320578984!2d71.47640807550027!3d51.13334935040133!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x424583e3df7af927%3A0xe0a61ac31d911428!2z0JbQsNC90LrQtdC90YIgMTgwLCDQkNGB0YLQsNC90LAgMDIwMDAw!5e0!3m2!1sru!2skz!4v1783337778567!5m2!1sru!2skz"
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 9: Footer */}
      <footer className="bg-primary text-on-primary border-t border-outline-variant/20 py-14 md:py-xl">
        <div className="max-w-[1280px] mx-auto px-5 md:px-lg lg:px-xl grid grid-cols-1 md:grid-cols-4 gap-md">
          <div className="space-y-md">
            <img alt="TiSei Logo" className="h-10 mb-md" src="/tisei-logo.png" />
            <p className="text-on-primary/60 font-body-md">Лидер в области технического обслуживания промышленного оборудования в РК.</p>
            <div className="flex gap-md">
             
            </div>
          </div>
          <div>
            <h4 className="font-headline-md mb-md">Разделы</h4>
            <ul className="space-y-sm text-on-primary/60">
              <li><a className="hover:text-secondary-fixed-dim transition-colors" href="#services">Услуги</a></li>
              <li><a className="hover:text-secondary-fixed-dim transition-colors" href="#workflow">Как мы работаем</a></li>
              <li><a className="hover:text-secondary-fixed-dim transition-colors" href="#reviews">Отзывы</a></li>
              <li><a className="hover:text-secondary-fixed-dim transition-colors" href="#contacts">Контакты</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-headline-md mb-md">Обслуживание</h4>
            <ul className="space-y-sm text-on-primary/60">
              <li>Аварийный выезд</li>
              <li>Диагностика систем</li>
              <li>Заправка фреоном</li>
              <li>Чистка конденсаторов</li>
            </ul>
          </div>
          <div>
            <h4 className="font-headline-md mb-md">Юридическая информация</h4>
            <p className="text-on-primary/60 mb-md font-body-md">ИП &quot;TiSei Service&quot;</p>
            <Link className="text-label-md text-secondary-fixed-dim hover:underline underline-offset-4" href="/privacy">Политика конфиденциальности</Link>
            <p className="mt-lg text-on-primary/40 font-mono-data text-xs">© 2024 TiSei. Все права защищены. Казахстан.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
