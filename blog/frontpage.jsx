const { Component, Fragment } = require('inferno');

module.exports = class extends Component {
    render() {
        const { site, config, page, helper } = this.props;
        const { url_for, date, date_xml, __, _p } = helper;
              console.log("site cats", site.categories)

        const postCount = site.posts.length;
        const categoryCount = site.categories.filter(category => category.length).length;
        const tagCount = site.tags.filter(tag => tag.length).length;

        return <Fragment>


            <div class="card">

                <article class={`smd card-content article${'direction' in page ? ' ' + page.direction : ''}`} role="article">

                    {/* Title */}
                    <h1 class="title is-3 is-size-4-mobile has-text-centered">
                        {page.title}
                    </h1>

                    <div class="frontpage"><div class="content">
                        {/* Content/Excerpt */}
                        {page.content ? <div dangerouslySetInnerHTML={{ __html: page.content }}></div> : ""}

                        <div class="card-content">
                            <div class="has-text-centered">
                                <b>Die Linkliste für Datascience, Datenvisualisierung und Open Data.</b>
                                <br /><br />
                            </div>
                            <nav class="level">
                                <div class="level-item has-text-centered flex-shrink-1">
                                    <div>
                                        <figure class="image is-400 mx-auto mb-2"><a href="#themen"><img class="avatar" src="/images/spass-mit-daten-logo.png" /></a></figure>
                                    </div>
                                </div>
                            </nav>
                            <nav class="level is-mobile">
                                <div class="level-item has-text-centered is-marginless">
                                    <div class="k-tag">
                                        <p class="heading">Links</p>
                                        <a href="/archives"><p class="title">{postCount}</p></a>
                                    </div>
                                </div>
                                <div class="level-item has-text-centered is-marginless">
                                    <div class="k-tag">
                                        <p class="heading">Kategorien</p>
                                        <a href="/categories"><p class="title">{categoryCount}</p></a>
                                </div>
                                </div>
                                <div class="level-item has-text-centered is-marginless">
                                    <div class="k-tag">
                                        <p class="heading">Tags</p>
                                        <a href="/tags"><p class="title">{tagCount}</p></a>
                                    </div></div>
                            </nav>
                        </div>

                        <br />
                        <div id="themen" class="has-text-centered mb-3">
                        Unsere Themen:
                        </div>

                    </div></div>


                    {(() => {

                        // sort categories by top categories and sub categories
                        var topCats = [];
                        var subCats = {};
                        site.categories.forEach((category, i) => {
                            if (category.parent) {
                                const parent = category.parent;
                                if (!subCats[parent] ) {
                                    subCats[parent] = [];
                                }
                                subCats[parent].push( category );
                            } else {
                                topCats.push(category);
                            }
                        });

                        // provide some background information about our topics
                        const info = [
                            {
                                // "Hintergrund"
                                hdl: "Hintergrundinformationen",
                                col: "is-info",
                                img: "gfx-book.png",
                                txt: "In dieser Kategorie sammlen wir Links zu Hintergrundinformationen zum Thema Open Data."
                                + " Das sind z.B. Handbücher, Leitfäden für Kommunen, Veranstaltungshinweise. Tipps wo man Fördergelder bekommen kann "
                                + " und Verweise auf Organisationen und Projekte die sich mit Offenen Daten befassen gehören ebenfalls dazu."
                            },
                            {
                                // "Datenquellen"
                                col: "is-primary",
                                img: "gfx-jonglieren.png",
                                txt: "Im Bereich 'Datenquellen' dreht es sich primär um Open-Data-Bezugsquellen. Außerdem um Daten, "
                                + "die man für Datascience-Projekte oder im Themengebiet Datenjournalismus (DDJ) nutzen kann. Dieser Bereich ist unser Kerngebiet, und hier sind sehr viele Links zu finden. Diese sind daher grob nach Themengebieten gruppiert. Wir empfehlen, auch unsere Stichwort-Suchfunktion zu nutzen (oben rechts auf der Seite)."
                            },
                            {
                                col: "is-warning",
                                img: "gfx-rocket.png",
                                txt: "'Tools', bzw. Anwendungen und Software die bei der Datenanalyse sowie Datenvisualisierung helfen können. Der Fokus liegt dabei auf Open-Souce-Entwicklungen. Gelistet haben wir auch proprietäre Cloud-Anwendungen (viele davon kostenfrei nutzbar), weil diese so schön einfach und bequem zum Einsatz zu bringen sind. Neu ist der Bereich 'Kollaboration', der nützliche Anwendungen enthält, die man für Online-Kollaboration mit Freunden und Kollegen nutzen kann."
                            }
                        ]

                        // create some nifty html
                        const html = [];
                        topCats.forEach((topCategory, i) => {
                            const subcontent = [];
                            const catConfig = info.shift();

                            subCats[topCategory._id].forEach((category, i) => {

                                const linkCount = category.posts.length;
                                var cls="is-size-6";
                                if (linkCount > 5) {cls = "is-size-5";}
                                if (linkCount > 10) {cls = "is-size-4";}
                                if (linkCount > 20) {cls = "is-size-3";}
                                if (linkCount > 40) {cls = "is-size-2";}

                                subcontent.push(
                                    <a class="link-muted mr-2" title={linkCount + " Links"} href={url_for(category.path)}>
                                        <span class={"tag mb-1 " + catConfig.col + " " + cls}>{category.name}</span>
                                    </a>
                                );
                            });
                            html.push(

                                <div class="fp-outer">
                                    <a class="title link is-2 is-size-3-mobile"
                                        href={url_for(topCategory.path)}>{catConfig.hdl || topCategory.name}</a>
                                    <div class="fp-image">
                                        <a href={url_for(topCategory.path)}><img src={"images/" + catConfig.img} /></a>
                                    </div>
                                    <div class={"notification " + catConfig.col + " is-light"}>
                                        <div class="alert alert-info" role="alert">
                                            <div class="my-3 has-text-black intro">{catConfig.txt}</div>
                                            <div class="mb-2">Unterkategorien:</div>
                                            {subcontent}
                                        </div>
                                    </div>
                                </div>);
                        });

                        return html;
                    })()}



                </article>
            </div>
        </Fragment>;
    }
};
