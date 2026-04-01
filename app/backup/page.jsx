"use client";

import { useEffect } from "react";

function useFadeInObserver() {
  useEffect(() => {
    const fadeInElements = document.querySelectorAll(".fade-in");

    const handleIntersection = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-slide-in");
          observer.unobserve(entry.target);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.1,
    });

    fadeInElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}

export default function Page() {
  useFadeInObserver();

  const products = Array.from({ length: 8 }).map((_, idx) => ({
    name: `Phone Model ${idx + 1}`,
    price: `$${599 + idx * 100}`,
  }));

  return (
    <div className="font-sans bg-gray-50">
      {/* Header */}
      <nav className="fixed top-0 left-0 w-full z-20 bg-white bg-opacity-90 shadow-md backdrop-blur-sm">
        <div className="container px-4 py-4 mx-auto md:px-8 lg:px-10">
          <div className="relative flex items-center justify-between">
            <a href="/" aria-label="Company" title="Company" className="inline-flex items-center">
              <i className="fas fa-mobile-alt text-2xl text-blue-600" aria-hidden />
              <span className="ml-2 text-xl font-bold tracking-wide text-gray-800 uppercase">
                Mobile Phone Stores
              </span>
            </a>

            <ul className="hidden lg:flex items-center space-x-6">
              <li>
                <a
                  href="/"
                  aria-label="Home"
                  title="Home"
                  className="font-medium tracking-wide text-gray-700 transition-colors duration-200 hover:text-blue-500"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#"
                  aria-label="Shop"
                  title="Shop"
                  className="font-medium tracking-wide text-gray-700 transition-colors duration-200 hover:text-blue-500"
                >
                  Shop
                </a>
              </li>
              <li>
                <a
                  href="#"
                  aria-label="About Us"
                  title="About Us"
                  className="font-medium tracking-wide text-gray-700 transition-colors duration-200 hover:text-blue-500"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="#"
                  aria-label="Contact"
                  title="Contact"
                  className="font-medium tracking-wide text-gray-700 transition-colors duration-200 hover:text-blue-500"
                >
                  Contact
                </a>
              </li>

              <li>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search Products..."
                    className="px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-300 w-48"
                  />
                  <button
                    type="button"
                    aria-label="Search"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    <i className="fas fa-search" aria-hidden />
                  </button>
                </div>
              </li>

              <li>
                <a
                  href="#"
                  className="text-gray-700 hover:text-blue-500 transition-colors duration-200"
                  aria-label="User"
                >
                  <i className="fas fa-user text-xl" aria-hidden />
                </a>
              </li>

              <li>
                <a
                  href="#"
                  className="text-gray-700 hover:text-blue-500 transition-colors duration-200 relative"
                  aria-label="Cart"
                >
                  <i className="fas fa-shopping-cart text-xl" aria-hidden />
                  <span className="absolute top-[-8px] right-[-8px] bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    3
                  </span>
                </a>
              </li>
            </ul>

            <div className="lg:hidden">
              <button
                type="button"
                aria-label="Open Menu"
                title="Open Menu"
                className="p-2 -mr-1 transition duration-200 rounded focus:outline-none focus:shadow-outline hover:bg-gray-100 focus:bg-gray-100"
              >
                <svg className="w-5 text-gray-600" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M23,13H1c-0.6,0-1-0.4-1-1s0.4-1,1-1h22c0.6,0,1,0.4,1,1S23.6,13,23,13z"
                  />
                  <path
                    fill="currentColor"
                    d="M23,6H1C0.4,6,0,5.6,0,5s0.4-1,1-1h22c0.6,0,1,0.4,1,1S23.6,6,23,6z"
                  />
                  <path
                    fill="currentColor"
                    d="M23,20H1c-0.6,0-1-0.4-1-1s0.4-1,1-1h22c0.6,0,1,0.4,1,1S23.6,20,23,20z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-20">
        {/* Hero */}
        <section
          className="relative bg-cover bg-center py-20 md:py-24 lg:py-32"
          style={{ backgroundImage: "url('/img-placeholder.svg')" }}
        >
          <div className="absolute inset-0 bg-black opacity-60" />
          <div className="container relative mx-auto px-4 md:px-8 lg:px-10 text-white flex flex-col justify-center items-center text-center">
            <h1 className="text-4xl font-extrabold mb-4 md:text-5xl lg:text-6xl text-shadow-custom fade-in">
              Discover the Latest Mobile Phones
            </h1>
            <p className="text-lg mb-8 md:text-xl text-shadow-custom fade-in">
              Explore our wide range of smartphones from top brands. Find your perfect device today!
            </p>
            <a
              href="#"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out scale-up-on-hover fade-in"
            >
              Shop Now <i className="fas fa-arrow-right ml-2" aria-hidden />
            </a>
          </div>
        </section>

        {/* Featured Products */}
        <section className="container mx-auto px-4 py-12 md:px-8 lg:px-10">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Featured Products</h2>
            <p className="text-gray-500">Check out our handpicked selection of mobile phones.</p>
          </div>

          <div className="flex justify-center mb-6 space-x-4 flex-wrap">
            {["All", "Brand A", "Brand B", "Budget", "Premium"].map((t) => (
              <button
                key={t}
                type="button"
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition duration-200"
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p, idx) => (
              <div
                key={p.name}
                className="bg-white rounded-lg shadow-md overflow-hidden transition-transform duration-300 transform hover:scale-105 scale-up-on-hover"
              >
                <img
                  className="w-full h-56 object-cover"
                  src="/img-placeholder.svg"
                  alt={p.name}
                />
                <div className="p-4">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {p.name}
                  </h3>
                  <p className="text-gray-600 mb-3">{p.price}</p>
                  <button
                    type="button"
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 w-full"
                  >
                    <i className="fas fa-cart-plus mr-2" aria-hidden />
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Compare */}
        <section className="container mx-auto px-4 py-12 md:px-8 lg:px-10 section-separator">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Compare Phones</h2>
            <p className="text-gray-500">Compare different mobile phone models side-by-side.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-auto text-gray-700 border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 border border-gray-300"></th>
                  <th className="py-2 px-4 border border-gray-300">
                    <select className="border rounded p-1 focus:outline-none focus:ring-2 focus:ring-blue-300 w-40" defaultValue="">
                      <option value="">Select Phone 1</option>
                      <option value="phone1">Phone Model A</option>
                      <option value="phone2">Phone Model B</option>
                      <option value="phone3">Phone Model C</option>
                    </select>
                  </th>
                  <th className="py-2 px-4 border border-gray-300">
                    <select className="border rounded p-1 focus:outline-none focus:ring-2 focus:ring-blue-300 w-40" defaultValue="">
                      <option value="">Select Phone 2</option>
                      <option value="phone1">Phone Model A</option>
                      <option value="phone2">Phone Model B</option>
                      <option value="phone3">Phone Model C</option>
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Display", "6.1 inch AMOLED", "6.5 inch IPS LCD"],
                  ["Camera", "12MP Dual", "16MP Triple"],
                  ["Battery", "3500 mAh", "4000 mAh"],
                  ["Storage", "128GB", "256GB"],
                  ["RAM", "8GB", "12GB"],
                ].map((row) => (
                  <tr key={row[0]}>
                    <td className="py-2 px-4 border border-gray-300 font-semibold">{row[0]}</td>
                    <td className="py-2 px-4 border border-gray-300">{row[1]}</td>
                    <td className="py-2 px-4 border border-gray-300">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <footer className="bg-gray-800 text-gray-300 py-12">
        <div className="container mx-auto px-4 md:px-8 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <i className="fas fa-mobile-alt text-2xl text-blue-500" aria-hidden />
                <span className="ml-2 text-2xl font-bold">Mobile Phone Stores</span>
              </div>
              <p className="text-sm mb-4">Your one-stop shop for all your mobile phone needs.</p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-blue-500 transition-colors duration-200">
                  <i className="fab fa-instagram text-xl" aria-hidden />
                </a>
                <a href="#" className="text-gray-400 hover:text-blue-500 transition-colors duration-200">
                  <i className="fab fa-twitter text-xl" aria-hidden />
                </a>
                <a href="#" className="text-gray-400 hover:text-blue-500 transition-colors duration-200">
                  <i className="fab fa-linkedin text-xl" aria-hidden />
                </a>
                <a href="#" className="text-gray-400 hover:text-blue-500 transition-colors duration-200">
                  <i className="fab fa-facebook text-xl" aria-hidden />
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 uppercase tracking-wide">Products</h4>
              <ul className="text-sm">
                <li className="mb-2">
                  <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                    Overview
                  </a>
                </li>
                <li className="mb-2">
                  <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                    Solutions
                  </a>
                </li>
                <li className="mb-2">
                  <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 uppercase tracking-wide">Company</h4>
              <ul className="text-sm">
                <li className="mb-2">
                  <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                    About
                  </a>
                </li>
                <li className="mb-2">
                  <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                    Jobs
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 uppercase tracking-wide">Support</h4>
              <ul className="text-sm">
                <li className="mb-2">
                  <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                    Contact
                  </a>
                </li>
                <li className="mb-2">
                  <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="text-center border-t border-gray-700 py-4 text-sm">
            © 2024 Mobile Phone Stores. All rights reserved.
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .text-shadow-custom {
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }

        .section-separator {
          border-bottom: 2px dashed #e2e8f0;
        }

        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .scale-up-on-hover {
          transition: transform 0.3s ease;
        }

        .scale-up-on-hover:hover {
          transform: scale(1.05);
        }

        .animate-slide-in {
          animation: slideIn 0.8s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
