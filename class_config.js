// CLASS_DAYS defines the order of days shown in the selection wizard
const CLASS_DAYS = ["周一", "周四", "周五", "周六", "周日"];

// CLASS_CONFIG organized by day -> time -> class data
const CLASS_CONFIG = {
    "周一": {
        "1810-1940": {
            students: ["Amy", "David", "Gavin", "Nick", "Sean", "Sophie"],
            content: { book: "PU1", unit: "1", page: "14" }
        }
    },
    "周四": {
        "1810-1940": {
            students: ["Aaron", "Daniel", "Domi", "Jojo", "Lucky", "Simon"],
            content: { book: "PU1", unit: "0", page: "5" }
        }
    },
    "周五": {
        "1900-2030": {
            students: ["Amy", "Colin", "Ethan", "Hollis", "Selena", "Sophia"],
            content: { book: "PU1", unit: "1", page: "14" }
        }
    },
    "周六": {
        "0900-1030": {
            students: ["Angel", "Dylan", "Mia", "YaoYao"],
            content: { book: "PU1", unit: "1", page: "14" }
        },
        "1040-1210": {
            students: ["Amy", "Annie", "Doris", "Harvey", "May", "Milk"],
            content: { book: "PU1", unit: "0", page: "5" }
        },
        "1310-1440": {
            students: ["Apple", "Lily", "Ryan", "Terry", "Toby"],
            content: { book: "PU1", unit: "0", page: "5" }
        },
        "1630-1800": {
            students: ["Coco", "Grayson", "Laura", "Leo"],
            content: { book: "PU1", unit: "0", page: "5" }
        },
        "1810-1940": {
            students: ["Annie", "Clarence", "Coco", "Gabriel"],
            content: { book: "PU1", unit: "0", page: "5" }
        }
    },
    "周日": {
        "0900-1030": {
            students: ["Candy", "Joying", "Lucas", "Nina", "Rex", "Yoyo"],
            content: { book: "PU1", unit: "0", page: "5" }
        },
        "1040-1210": {
            students: ["Amber", "Cindy", "Gaby", "Louis", "Kelly", "Susie"],
            content: { book: "PU1", unit: "0", page: "5" }
        },
        "1310-1440": {
            students: ["Grace", "Frank", "William", "Joe"],
            content: { book: "PU1", unit: "0", page: "5" }
        },
        "1450-1620": {
            students: ["Dave", "Irene", "Lele", "Mia", "Sylvia"],
            content: { book: "PU1", unit: "0", page: "5" }
        },
        "1630-1800": {
            students: ["James", "Jenny", "Koey", "Minnie", "Mia", "Pudding"],
            content: { book: "PU1", unit: "0", page: "5" }
        }
    }
};
