## COX HACKATHON PROJECT

Try it out: cox-hackathon-26-iota.vercel.app


Inspiration

Atlanta has thousands of buildings sitting under roofs that trap heat. After learning about the city’s new cool roof ordinance, we realized the law creates urgency, but it does not really tell building owners what to do next. That gap inspired GreenTop. We wanted to build something that answered the real question a building owner would ask: what should I actually do with my roof?

What It Does

GreenTop helps Atlanta building owners compare rooftop upgrades based on their actual building. A user enters an address and roof information, and GreenTop creates a ranked plan for options like cool roof coating, solar panels, green roofs, and rainwater harvesting among other sustainable roof practices. Instead of giving a generic sustainability recommendation, it compares the options by estimated cost, savings, payback period, climate impact, and feasibility. The goal is to make roof upgrades feel less confusing and more actionable.

How We Built It

We built GreenTop as a dashboard where the user starts by entering their building details. We use rooftop and solar data to understand the roof, then use Gemini to analyze the user’s inputs and help generate a clearer recommendation. The final dashboard shows the best rooftop options, estimated ROI, payback period, energy savings, and environmental impact. We wanted the result to feel like a real decision tool, not just a calculator.

Challenges We Ran Into

Rooftop decisions depend on a lot of factors, like roof size, sunlight, shade, energy costs, building type, budget, and structural limits. We had to decide what information mattered most for our demo and how to show it without overwhelming the user. Another challenge was making the recommendations feel specific. We did not want every building to get the same answer. A roof that is great for solar might not be the best fit for a green roof, and a smaller building might care more about fast payback than long term impact.

Accomplishments We're Proud Of

We are proud that GreenTop connects a real Atlanta policy to a real user need. Instead of building a broad sustainability app, we focused on a specific problem happening right now in Atlanta. The city has created a push toward cooler roofs, and GreenTop helps building owners understand how to respond in a way that also saves money. We are also proud of making the dashboard feel practical. A user can go from an address to a rooftop action plan without needing to understand every detail of climate policy, solar modeling, or green infrastructure.

What We Learned

People care about sustainability, but decisions usually come down to cost, timing, and trust. GreenTop taught us that the best tools are the ones that connect climate impact to everyday decisions, like whether a roof upgrade is worth it for a specific building. We also learned how important local context is. Atlanta’s heat problem, roof policy, and building stock make this a very specific opportunity, and that made our project stronger.

What's Next for GreenTop

Next, we want to expand GreenTop beyond Atlanta and bring it to other cities dealing with extreme heat, roof mandates, and rising energy costs.

Atlanta was the perfect place to start because the cool roof law made the problem urgent, but this is not only an Atlanta issue. Cities across the country are trying to reduce heat, lower energy use, and make buildings more sustainable.

Long term, we want GreenTop to become a rooftop planning tool that works anywhere. A building owner could enter an address in any city and get a clear plan for the best roof upgrades based on local climate, energy prices, policies, and incentives.

Built With: gemini-api, google-solar-api, next.js, python, tailwind-css
