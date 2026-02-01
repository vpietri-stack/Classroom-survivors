// CLASS_DAYS defines the order of days shown in the selection wizard
const CLASS_DAYS = ["周一", "周四", "周五", "周六", "周日"];

/**
 *    Available content PU1:
        0: [4, 5, 7, 8],
        1: [9, 10, 11, 12, 13, 14, 15, 16],
        2: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
        3: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 43]
    
    PU2 
       0: [5],
        1: [16],
        2: [28],
        3: [40, 43],
        4: [54],
        5: [66],
        6: [78, 81],
        7: [91],
        8: [104],
        9: [116, 119]

    PU3: 
        0: [5]
 */

// CLASS_CONFIG organized by day -> time -> class data
const CLASS_CONFIG = {
    "周一": {
        "1810-1940": {
            students: ["Amy", "David", "Gavin", "Nick", "Sean", "Sophie"],
            content: { book: "PU1", unit: "1", page: "16" }
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
            content: { book: "PU1", unit: "1", page: "16" }
        }
    },
    "周六": {
        "0900-1030": {
            students: ["Angel", "Eddy", "Dylan", "Mia", "YaoYao"],
            content: { book: "PU1", unit: "1", page: "16" }
        },
        "1040-1210": {
            students: ["Amy", "Annie", "Doris", "Harvey", "May", "Milk"],
            content: { book: "PU2", unit: "6", page: "81" }
        },
        "1310-1440": {
            students: ["Apple", "Lily", "Ryan", "Terry", "Toby"],
            content: { book: "PU2", unit: "0", page: "5" }
        },
        "1630-1800": {
            students: ["Coco", "Grayson", "Laura", "Leo"],
            content: { book: "PU3", unit: "0", page: "5" }
        },
        "1810-1940": {
            students: ["Annie", "Clarence", "Coco", "Gabriel"],
            content: { book: "PU3", unit: "0", page: "5" }
        }
    },
    "周日": {
        "0900-1030": {
            students: ["Candy", "Joying", "Lucas", "Nina", "Rex", "Yoyo"],
            content: { book: "PU3", unit: "0", page: "5" }
        },
        "1040-1210": {
            students: ["Amber", "Cindy", "Gaby", "Louis", "Kelly", "Susie"],
            content: { book: "PU1", unit: "0", page: "5" }
        },
        "1310-1440": {
            students: ["Grace", "Frank", "William", "Joe"],
            content: { book: "PU3", unit: "0", page: "5" }
        },
        "1450-1620": {
            students: ["Dave", "Irene", "Lele", "Mia", "Sylvia"],
            content: { book: "PU2", unit: "3", page: "43" }
        },
        "1630-1800": {
            students: ["James", "Jenny", "Koey", "Minnie", "Mia", "Pudding"],
            content: { book: "PU2", unit: "7", page: "91" }
        }
    }
};
